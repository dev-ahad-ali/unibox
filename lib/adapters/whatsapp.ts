import { randomUUID } from "node:crypto";
import { graphRequest, verifyMetaSignature } from "@/lib/adapters/graph";
import type {
  AuthorizedChannel,
  ChannelAdapter,
  DeliveryStatusUpdate,
  MessageStatus,
  NormalizedMessage,
  OutboundMessage,
  ParsedWebhook
} from "@/lib/types";

type WhatsAppMedia = { id?: string; mime_type?: string; caption?: string; filename?: string };

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: WhatsAppMedia;
  video?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  document?: WhatsAppMedia;
  sticker?: WhatsAppMedia;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string; description?: string };
  };
};

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ title?: string; message?: string }>;
};

/** WhatsApp timestamps are epoch *seconds*, unlike the rest of the Graph API. */
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

/**
 * Cloud API hands us a media *id*, not a URL, and the download URL it resolves
 * to is short-lived and requires the access token. We store a link to our own
 * proxy route instead so the thread keeps rendering after the URL expires.
 */
function media(message: WhatsAppMessage) {
  const item = message.image ?? message.video ?? message.audio ?? message.document ?? message.sticker;
  if (!item?.id) {
    return {};
  }

  return {
    mediaUrl: `/api/media/whatsapp/${encodeURIComponent(item.id)}`,
    mediaType: item.mime_type ?? message.type
  };
}

function toMessageStatus(status: string | undefined): MessageStatus | null {
  switch (status) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

function accessToken(channel: AuthorizedChannel) {
  const token = channel.credentials.accessToken;
  if (!token) {
    throw new Error(
      `No access token stored for WhatsApp channel "${channel.displayName}". Reconnect it from /admin/channels.`
    );
  }
  return token;
}

function phoneNumberId(channel: AuthorizedChannel) {
  const id = channel.externalAccountId;
  if (!id) {
    throw new Error("WhatsApp requires a phone number id (channels.external_account_id).");
  }
  return id;
}

export const whatsappAdapter: ChannelAdapter = {
  /**
   * Names the addressed number so the pipeline can find its organization — and
   * therefore which Meta app secret to verify against — before checking the
   * signature. `entry[].id` is the WABA id, not the routing key.
   */
  webhookAccountId(payload: any) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const phoneNumberId = change?.value?.metadata?.phone_number_id;
        if (typeof phoneNumberId === "string") {
          return phoneNumberId;
        }
      }
    }
    return undefined;
  },
  verifyWebhook(context) {
    // WhatsApp Cloud API callbacks are signed with the Meta app secret.
    return verifyMetaSignature(context);
  },
  parseIncoming(payload: any): ParsedWebhook {
    const messages: NormalizedMessage[] = [];
    const statuses: DeliveryStatusUpdate[] = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value;
        // Route on phone_number_id, not the WABA id on `entry`, so an org with
        // several numbers lands each thread on the right channel.
        const accountId = value?.metadata?.phone_number_id;

        const contacts = new Map<string, string | undefined>(
          (Array.isArray(value?.contacts) ? value.contacts : [])
            .filter((contact: any) => contact?.wa_id)
            .map((contact: any): [string, string | undefined] => [contact.wa_id, contact?.profile?.name])
        );

        for (const item of (Array.isArray(value?.messages) ? value.messages : []) as WhatsAppMessage[]) {
          if (!item.from) continue;
          messages.push({
            accountId,
            externalContactId: item.from,
            contactName: contacts.get(item.from),
            body: messageBody(item),
            platformMessageId: item.id ?? randomUUID(),
            timestamp: toDate(item.timestamp),
            ...media(item)
          });
        }

        for (const item of (Array.isArray(value?.statuses) ? value.statuses : []) as WhatsAppStatus[]) {
          const mapped = toMessageStatus(item.status);
          if (!item.id || !mapped) continue;
          statuses.push({
            accountId,
            platformMessageId: item.id,
            status: mapped,
            timestamp: toDate(item.timestamp)
          });
        }
      }
    }

    return { messages, statuses };
  },
  async sendMessage(channel: AuthorizedChannel, externalContactId: string, message: OutboundMessage) {
    const data = await graphRequest<{ messages?: Array<{ id?: string }> }>(
      `${phoneNumberId(channel)}/messages`,
      {
        method: "POST",
        accessToken: accessToken(channel),
        body: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: externalContactId.replace(/^\+/, ""),
          type: "text",
          text: { preview_url: false, body: message.body }
        }
      }
    );

    const platformMessageId = data.messages?.[0]?.id;
    if (!platformMessageId) {
      throw new Error("WhatsApp send succeeded but returned no message id.");
    }

    return { platformMessageId };
  },
  async verifyCredentials(channel: AuthorizedChannel) {
    const data = await graphRequest<{ display_phone_number?: string; verified_name?: string }>(
      `${phoneNumberId(channel)}?fields=display_phone_number,verified_name`,
      { method: "GET", accessToken: accessToken(channel) }
    );

    return {
      label: [data.verified_name, data.display_phone_number].filter(Boolean).join(" · ") ||
        channel.externalAccountId
    };
  }
};

/** Resolves a Cloud API media id to its (short-lived, authenticated) download URL. */
export async function resolveWhatsAppMedia(channel: AuthorizedChannel, mediaId: string) {
  const token = accessToken(channel);
  const data = await graphRequest<{ url?: string; mime_type?: string }>(mediaId, {
    method: "GET",
    accessToken: token
  });

  if (!data.url) {
    throw new Error(`WhatsApp media ${mediaId} has no download URL.`);
  }

  return { url: data.url, mimeType: data.mime_type, accessToken: token };
}

type IdList = { data?: Array<{ id?: string }> };

/**
 * Finds the WhatsApp Business Account a phone number belongs to. The Cloud API
 * sends to the phone number id, so that is all a channel stores — but webhook
 * subscriptions are made on the WABA. Returns undefined rather than throwing:
 * callers only use this to pre-fill values for the admin.
 */
export async function findWhatsAppBusinessAccountId(token: string, phoneNumberId: string) {
  const ownsNumber = async (wabaId: string) => {
    const numbers = await graphRequest<IdList>(`${wabaId}/phone_numbers?fields=id&limit=100`, {
      method: "GET",
      accessToken: token
    });
    return (numbers.data ?? []).some(entry => entry.id === phoneNumberId);
  };

  const candidates = new Set<string>();

  // A System User token names the WABAs it was granted in its own granular
  // scopes. A token may inspect itself, so no app token is needed.
  try {
    const debug = await graphRequest<{
      data?: { granular_scopes?: Array<{ scope?: string; target_ids?: string[] }> };
    }>(`debug_token?input_token=${encodeURIComponent(token)}`, { method: "GET", accessToken: token });
    for (const entry of debug.data?.granular_scopes ?? []) {
      if (entry.scope?.startsWith("whatsapp_business_")) {
        for (const id of entry.target_ids ?? []) candidates.add(id);
      }
    }
  } catch {
    // Fall through to walking the businesses below.
  }

  // User tokens with full access carry no target ids; walk their businesses.
  if (candidates.size === 0) {
    try {
      const businesses = await graphRequest<IdList>("me/businesses?limit=50", { method: "GET", accessToken: token });
      for (const business of businesses.data ?? []) {
        if (!business.id) continue;
        for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
          const wabas = await graphRequest<IdList>(`${business.id}/${edge}?limit=50`, {
            method: "GET",
            accessToken: token
          }).catch(() => ({ data: [] }) as IdList);
          for (const waba of wabas.data ?? []) if (waba.id) candidates.add(waba.id);
        }
      }
    } catch {
      return undefined;
    }
  }

  for (const wabaId of candidates) {
    if (await ownsNumber(wabaId).catch(() => false)) {
      return wabaId;
    }
  }
  return undefined;
}
