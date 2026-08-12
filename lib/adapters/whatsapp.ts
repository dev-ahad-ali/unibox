import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Channel, ChannelAdapter, NormalizedMessage, OutboundMessage } from "@/lib/types";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
  document?: { id?: string; caption?: string; mime_type?: string; filename?: string };
  sticker?: { id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string; description?: string };
  };
};

function toDate(value: unknown) {
  const seconds = typeof value === "string" ? Number(value) : value;
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000)
    : new Date();
}

function messageBody(message: WhatsAppMessage) {
  if (message.text?.body) return message.text.body;
  if (message.image?.caption) return message.image.caption;
  if (message.video?.caption) return message.video.caption;
  if (message.document?.caption) return message.document.caption;
  if (message.document?.filename) return message.document.filename;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.location?.latitude !== undefined && message.location?.longitude !== undefined) {
    return [message.location.name, message.location.address, `${message.location.latitude}, ${message.location.longitude}`]
      .filter(Boolean)
      .join(" — ");
  }
  return message.type ? `[${message.type}]` : undefined;
}

function media(message: WhatsAppMessage) {
  const item = message.image ?? message.video ?? message.audio ?? message.document ?? message.sticker;
  return item ? { mediaUrl: item.id, mediaType: item.mime_type ?? message.type } : {};
}

function validMetaSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export const whatsappAdapter: ChannelAdapter = {
  verifyWebhook(request) {
    const appSecret = process.env.META_APP_SECRET;
    // Meta signs WhatsApp callbacks using the app secret. Keep verification strict
    // whenever a secret is configured; leaving it unset supports local scaffolding only.
    return !appSecret || validMetaSignature(
      request.headers.get("x-unibox-raw-body") ?? "",
      request.headers.get("x-hub-signature-256"),
      appSecret
    );
  },
  parseIncoming(payload: any): NormalizedMessage[] {
    const normalized: NormalizedMessage[] = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value;
        const contacts = new Map<string, string | undefined>(
          (Array.isArray(value?.contacts) ? value.contacts : [])
            .filter((contact: any) => contact?.wa_id)
            .map((contact: any): [string, string | undefined] => [contact.wa_id, contact?.profile?.name])
        );

        for (const item of (Array.isArray(value?.messages) ? value.messages : []) as WhatsAppMessage[]) {
          if (!item.from) continue;
          normalized.push({
            externalContactId: item.from,
            contactName: contacts.get(item.from),
            body: messageBody(item),
            platformMessageId: item.id ?? randomUUID(),
            timestamp: toDate(item.timestamp),
            ...media(item)
          });
        }
      }
    }

    return normalized;
  },
  async sendMessage(_channel: Channel, externalContactId: string, message: OutboundMessage) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v23.0";

    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp Cloud API requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
    }

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: externalContactId.replace(/^\+/, ""),
        type: "text",
        text: { preview_url: false, body: message.body }
      })
    });

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number };
    };
    const platformMessageId = data.messages?.[0]?.id;
    if (!response.ok || !platformMessageId) {
      throw new Error(data.error?.message ?? `WhatsApp Cloud API request failed (${response.status}).`);
    }
    return { platformMessageId };
  }
};
