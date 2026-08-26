import { getAdapter } from "@/lib/adapters";
import {
  authorizeChannel,
  findChannelForEvent,
  getWebhookSecretForEvent,
  insertMessage,
  logWebhookEvent,
  messageExists,
  updateMessageStatus,
  upsertConversation
} from "@/lib/store";
import { createServiceClient, isSupabaseConfigured, type Db } from "@/lib/supabase";
import type { Channel, Platform } from "@/lib/types";
import { emitOrgEvent, emitConversationEvent } from "@/lib/socket";

export async function processWebhook(platform: Platform, request: Request) {
  const adapter = getAdapter(platform);

  // The raw body is passed alongside the request rather than through it. An
  // earlier version stuffed it into a header, which throws on any character
  // above U+00FF — every Japanese or emoji message failed before verification.
  const rawBody = await request.text();

  const logDb: Db = isSupabaseConfigured() ? createServiceClient() : null;

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    void logWebhookEvent(logDb, { platform, outcome: "malformed" });
    return Response.json({ error: "Malformed webhook payload" }, { status: 400 });
  }

  // Platforms that authenticate with a per-channel secret (LINE, Telegram)
  // name the addressed account in the payload or URL, so the secret can be
  // looked up before verification. Parsing untrusted JSON first is fine —
  // nothing is ingested until the signature check below passes.
  const accountHint = adapter.webhookAccountId?.(payload, request);
  let channelSecret: string | null = null;
  if (adapter.webhookAccountId) {
    channelSecret = await getWebhookSecretForEvent(logDb, platform, accountHint);
  }

  if (!(await adapter.verifyWebhook({ request, rawBody, secret: channelSecret }))) {
    void logWebhookEvent(logDb, {
      platform,
      externalAccountId: accountHint,
      outcome: "invalid_signature"
    });
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  // Inbound messages have no signed-in user behind them, and the platform
  // signature is the authentication. RLS cannot express "this request came from
  // Meta", so ingestion runs on the service client.
  const db: Db = isSupabaseConfigured() ? createServiceClient() : null;

  const { messages, statuses } = adapter.parseIncoming(payload);

  // One lookup per distinct account id instead of one per event.
  const channelCache = new Map<string, Channel | undefined>();
  const resolveChannel = async (accountId?: string) => {
    const key = accountId ?? "__default__";
    if (!channelCache.has(key)) {
      channelCache.set(key, await findChannelForEvent(db, platform, accountId));
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
    if (await messageExists(db, event.platformMessageId)) {
      duplicates += 1;
      continue;
    }

    const conversation = await upsertConversation(db, {
      channelId: channel.id,
      externalContactId: event.externalContactId,
      contactName: event.contactName
    });

    const message = await insertMessage(db, {
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
      profileLookups.push(enrichContact(db, channel, conversation.id, event.externalContactId, platform));
    }
  }

  for (const receipt of statuses) {
    await updateMessageStatus(db, receipt.platformMessageId, receipt.status);

    // Delivery/read ticks used to reach the browser only as a side effect of
    // the next full refresh. The client store patches them in place instead.
    const channel = await resolveChannel(receipt.accountId);
    if (channel) {
      emitOrgEvent(channel.orgId, "message_status", {
        platform,
        platformMessageId: receipt.platformMessageId,
        status: receipt.status
      });
    }
  }

  for (const orgId of orgIds) {
    emitOrgEvent(orgId, "webhook_received", { platform, count: ingested });
  }

  // The delivery log is what the channels screen's health line reads. An empty
  // signed call (LINE's Verify button, a status-only delivery) still resolves
  // the addressed channel so setup checks can go green before the first
  // customer message.
  const loggedChannel =
    (await resolveChannel(messages[0]?.accountId ?? statuses[0]?.accountId ?? accountHint)) ?? undefined;
  void logWebhookEvent(logDb, {
    platform,
    externalAccountId: accountHint ?? messages[0]?.accountId,
    channelId: loggedChannel?.id,
    orgId: loggedChannel?.orgId,
    outcome:
      ingested > 0
        ? "ingested"
        : duplicates > 0
          ? "duplicate"
          : messages.length > 0
            ? "unmatched"
            : "empty",
    messageCount: ingested
  });

  // A message-less but signed call (LINE's Verify button) still notifies the
  // org room, so the channels screen can flip its setup check live.
  if (loggedChannel && !orgIds.has(loggedChannel.orgId)) {
    emitOrgEvent(loggedChannel.orgId, "webhook_received", { platform, count: 0 });
  }

  // Deliberately not awaited — the platform needs its 200 quickly.
  void Promise.allSettled(profileLookups);

  return Response.json({ ok: true, processed: ingested, duplicates, statuses: statuses.length });
}

async function enrichContact(
  db: Db,
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
    const authorized = await authorizeChannel(db, channel);
    const profile = await adapter.fetchContactProfile(authorized, externalContactId);
    await upsertConversation(db, {
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
