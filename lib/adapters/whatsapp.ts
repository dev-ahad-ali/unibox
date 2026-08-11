import { randomUUID } from "node:crypto";
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

export const whatsappAdapter: ChannelAdapter = {
  verifyWebhook(request) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) {
      return true;
    }

    const signature = request.headers.get("x-webhook-signature") ?? request.headers.get("x-signature");
    return signature === secret;
  },
  parseIncoming(payload: any): NormalizedMessage[] {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    return messages.map((item: any) => ({
      externalContactId: item?.from ?? item?.contact_id ?? "unknown",
      contactName: item?.profile?.name,
      body: item?.text?.body ?? item?.body,
      mediaUrl: item?.media?.url,
      mediaType: item?.media?.type,
      platformMessageId: item?.id ?? randomUUID(),
      timestamp: toDate(item?.timestamp ?? Date.now())
    }));
  },
  async sendMessage(_channel: Channel, _externalContactId: string, message: OutboundMessage) {
    return {
      platformMessageId: `wa_${randomUUID()}_${message.body?.slice(0, 8) ?? "msg"}`
    };
  }
};
