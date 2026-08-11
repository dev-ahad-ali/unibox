import { createHmac, randomUUID } from "node:crypto";
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

export const lineAdapter: ChannelAdapter = {
  verifyWebhook(request) {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      return true;
    }

    const signature = request.headers.get("x-line-signature");
    const rawBody = request.headers.get("x-unibox-raw-body") ?? "";
    const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
    return signature === expected;
  },
  parseIncoming(payload: any): NormalizedMessage[] {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events
      .filter((event: any) => event?.type === "message")
      .map((event: any) => ({
        externalContactId: event?.source?.userId ?? "line_user",
        contactName: event?.source?.displayName,
        body: event?.message?.text,
        mediaUrl: undefined,
        mediaType: event?.message?.type,
        platformMessageId: event?.message?.id ?? randomUUID(),
        timestamp: toDate(event?.timestamp ?? Date.now())
      }));
  },
  async sendMessage(_channel: Channel, _externalContactId: string, message: OutboundMessage) {
    return {
      platformMessageId: `line_${randomUUID()}_${message.body?.slice(0, 8) ?? "msg"}`
    };
  }
};
