import { getAdapter } from "@/lib/adapters";
import { findChannelByPlatform, insertMessage, upsertConversation } from "@/lib/store";
import type { Platform } from "@/lib/types";
import { emitOrgEvent, emitConversationEvent } from "@/lib/socket";

export async function processWebhook(platform: Platform, request: Request) {
  const adapter = getAdapter(platform);
  const rawBody = await request.text();
  const signedRequest = new Request(request.url, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      "x-unibox-raw-body": rawBody
    },
    body: rawBody
  });

  if (!(await adapter.verifyWebhook(signedRequest))) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = { rawBody };
  }

  const events = adapter.parseIncoming(payload);
  let orgId: string | null = null;
  const responses = [];

  for (const event of events) {
    const channel = await findChannelByPlatform(platform);
    if (!channel) {
      continue;
    }
    orgId = channel.orgId;

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

    emitConversationEvent(conversation.id, "new_message", { platform, conversationId: conversation.id, message });
    responses.push(message);
  }

  if (orgId) {
    emitOrgEvent(orgId, "webhook_received", { platform, count: responses.length });
  }

  return Response.json({ ok: true, processed: responses.length });
}
