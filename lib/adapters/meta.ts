import { randomUUID, createHmac } from "node:crypto";
import type { Channel, ChannelAdapter, NormalizedMessage, OutboundMessage } from "@/lib/types";

function toDate(value: unknown) {
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  }
  return new Date();
}

function parseMetaEntries(payload: any): NormalizedMessage[] {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const messages: NormalizedMessage[] = [];

  for (const entry of entries) {
    const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const event of messagingEvents) {
      const senderId = event?.sender?.id;
      const message = event?.message;
      if (!senderId || !message) {
        continue;
      }

      messages.push({
        externalContactId: senderId,
        contactName: event?.sender?.name,
        body: message?.text,
        mediaUrl: message?.attachments?.[0]?.payload?.url,
        mediaType: message?.attachments?.[0]?.type,
        platformMessageId: event?.mid ?? randomUUID(),
        timestamp: toDate(event?.timestamp ?? Date.now())
      });
    }
  }

  return messages;
}

export function createMetaAdapter(platform: "messenger" | "instagram"): ChannelAdapter {
  return {
    verifyWebhook(request) {
      const secret = process.env.META_APP_SECRET;
      if (!secret) {
        return true;
      }

      const signature = request.headers.get("x-hub-signature-256");
      if (!signature?.startsWith("sha256=")) {
        return false;
      }

      const body = request.headers.get("x-unibox-raw-body") ?? "";
      const expected = createHmac("sha256", secret).update(body).digest("hex");
      return signature.slice(7) === expected;
    },
    parseIncoming(payload) {
      return parseMetaEntries(payload).map(message => ({
        ...message,
        contactName: message.contactName || `${platform} contact`
      }));
    },
    async sendMessage(_channel: Channel, _externalContactId: string, message: OutboundMessage) {
      return {
        platformMessageId: `meta_${randomUUID()}_${message.body?.slice(0, 8) ?? "msg"}`
      };
    }
  };
}
