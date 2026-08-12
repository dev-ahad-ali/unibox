import { getAdapter } from "@/lib/adapters";
import {
  authorizeChannel,
  findChannelForEvent,
  insertMessage,
  messageExists,
  updateMessageStatus,
  upsertConversation
} from "@/lib/store";
import type { Channel, Platform } from "@/lib/types";
import { emitOrgEvent, emitConversationEvent } from "@/lib/socket";

export async function processWebhook(platform: Platform, request: Request) {
  const adapter = getAdapter(platform);

  // The raw body is passed alongside the request rather than through it. An
  // earlier version stuffed it into a header, which throws on any character
  // above U+00FF — every Japanese or emoji message failed before verification.
  const rawBody = await request.text();

  if (!adapter.verifyWebhook({ request, rawBody })) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json({ error: "Malformed webhook payload" }, { status: 400 });
  }

  const { messages, statuses } = adapter.parseIncoming(payload);

  // One lookup per distinct account id instead of one per event.
  const channelCache = new Map<string, Channel | undefined>();
  const resolveChannel = async (accountId?: string) => {
    const key = accountId ?? "__default__";
    if (!channelCache.has(key)) {
      channelCache.set(key, await findChannelForEvent(platform, accountId));
    }
    return channelCache.get(key);
  };

  const orgIds = new Set<string>();
  let ingested = 0;
  let duplicates = 0;
  const profileLookups: Array<Promise<void>> = [];

  for (const event of messages) {
    const channel = await resolveChannel(event.accountId);
    if (!channel) {
      continue;
    }
    orgIds.add(channel.orgId);

    // Platforms redeliver until they see a 200, so the same message id can
    // arrive several times.
    if (await messageExists(event.platformMessageId)) {
      duplicates += 1;
      continue;
    }

    const conversation = await upsertConversation({
      channelId: channel.id,
      externalContactId: event.externalContactId,
      contactName: event.contactName
    });

    const message = await insertMessage({
      conversationId: conversation.id,
      direction: "inbound",
      senderType: "customer",
      body: event.body,
      mediaUrl: event.mediaUrl,
      mediaType: event.mediaType,
      platformMessageId: event.platformMessageId,
      status: "delivered"
    });

    ingested += 1;

    emitConversationEvent(conversation.id, "new_message", {
      platform,
      conversationId: conversation.id,
      message
    });
    emitOrgEvent(channel.orgId, "new_message", {
      platform,
      conversationId: conversation.id,
      message
    });

    // Profile enrichment is a second round-trip to the platform. It must not
    // hold up the webhook ack, so it runs detached.
    if (!conversation.contactName || conversation.contactName === conversation.externalContactId) {
      profileLookups.push(enrichContact(channel, conversation.id, event.externalContactId, platform));
    }
  }

  for (const receipt of statuses) {
    await updateMessageStatus(receipt.platformMessageId, receipt.status);
  }

  for (const orgId of orgIds) {
    emitOrgEvent(orgId, "webhook_received", { platform, count: ingested });
  }

  // Deliberately not awaited — the platform needs its 200 quickly.
  void Promise.allSettled(profileLookups);

  return Response.json({ ok: true, processed: ingested, duplicates, statuses: statuses.length });
}

async function enrichContact(
  channel: Channel,
  conversationId: string,
  externalContactId: string,
  platform: Platform
) {
  const adapter = getAdapter(platform);
  if (!adapter.fetchContactProfile) {
    return;
  }

  try {
    const authorized = await authorizeChannel(channel);
    const profile = await adapter.fetchContactProfile(authorized, externalContactId);
    await upsertConversation({
      channelId: channel.id,
      externalContactId,
      contactName: profile.name,
      contactAvatarUrl: profile.avatarUrl
    });
    emitConversationEvent(conversationId, "conversation_updated", { conversationId });
  } catch {
    // A failed profile lookup must never turn into a failed webhook — the
    // conversation keeps the platform id as its display name.
  }
}
