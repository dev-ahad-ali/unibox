import { randomUUID } from "node:crypto";
import { graphRequest, verifyMetaSignature } from "@/lib/adapters/graph";
import type {
  AuthorizedChannel,
  ChannelAdapter,
  DeliveryStatusUpdate,
  NormalizedMessage,
  OutboundMessage,
  ParsedWebhook
} from "@/lib/types";

type MetaAttachment = {
  type?: string;
  payload?: { url?: string; sticker_id?: number };
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    attachments?: MetaAttachment[];
  };
  delivery?: { mids?: string[]; watermark?: number };
  read?: { watermark?: number };
  reaction?: unknown;
};

function toDate(value: unknown) {
  // Meta timestamps are epoch milliseconds.
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : new Date();
}

function accessToken(channel: AuthorizedChannel, platform: "messenger" | "instagram") {
  const fallback =
    platform === "instagram"
      ? process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN
      : process.env.META_PAGE_ACCESS_TOKEN;

  const token = channel.credentials.accessToken || fallback;
  if (!token) {
    throw new Error(
      `No access token for ${platform} channel "${channel.displayName}". Store one in channels.access_token_encrypted or set META_PAGE_ACCESS_TOKEN.`
    );
  }

  return token;
}

function parseMetaEntries(payload: any): ParsedWebhook {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const messages: NormalizedMessage[] = [];
  const statuses: DeliveryStatusUpdate[] = [];

  for (const entry of entries) {
    // entry.id is the Page id (Messenger) or the IG account id (Instagram).
    const accountId = typeof entry?.id === "string" ? entry.id : undefined;
    const events: MetaMessagingEvent[] = Array.isArray(entry?.messaging) ? entry.messaging : [];

    for (const event of events) {
      if (event.delivery) {
        for (const mid of event.delivery.mids ?? []) {
          statuses.push({
            accountId,
            platformMessageId: mid,
            status: "delivered",
            timestamp: toDate(event.timestamp)
          });
        }
        continue;
      }

      // `read` is a watermark, not a message id — we can only mark the thread
      // as read up to that point, which the store handles by timestamp.
      if (event.read) {
        continue;
      }

      const senderId = event.sender?.id;
      const message = event.message;
      if (!senderId || !message || message.is_deleted) {
        continue;
      }

      // Echoes are our own outbound replies coming back through the webhook.
      // Ingesting them would duplicate every agent reply as a customer message.
      if (message.is_echo) {
        continue;
      }

      const attachment = message.attachments?.[0];

      messages.push({
        accountId,
        externalContactId: senderId,
        body: message.text,
        mediaUrl: attachment?.payload?.url,
        mediaType: attachment?.type,
        platformMessageId: message.mid ?? randomUUID(),
        timestamp: toDate(event.timestamp)
      });
    }
  }

  return { messages, statuses };
}

export function createMetaAdapter(platform: "messenger" | "instagram"): ChannelAdapter {
  return {
    verifyWebhook(context) {
      return verifyMetaSignature(context);
    },
    parseIncoming(payload) {
      return parseMetaEntries(payload);
    },
    async sendMessage(channel: AuthorizedChannel, externalContactId: string, message: OutboundMessage) {
      const token = accessToken(channel, platform);

      // Messenger posts to the Page id, Instagram to the IG user id. Both are
      // stored as the channel's external_account_id.
      const data = await graphRequest<{ message_id?: string; recipient_id?: string }>(
        `${channel.externalAccountId}/messages`,
        {
          method: "POST",
          accessToken: token,
          body: {
            recipient: { id: externalContactId },
            messaging_type: "RESPONSE",
            message: message.mediaUrl
              ? {
                  attachment: {
                    type: message.mediaType?.split("/")[0] || "file",
                    payload: { url: message.mediaUrl, is_reusable: true }
                  }
                }
              : { text: message.body }
          }
        }
      );

      if (!data.message_id) {
        throw new Error(`${platform} send succeeded but returned no message_id.`);
      }

      return { platformMessageId: data.message_id };
    },
    async fetchContactProfile(channel: AuthorizedChannel, externalContactId: string) {
      const token = accessToken(channel, platform);
      const fields = platform === "instagram" ? "name,username,profile_pic" : "name,profile_pic";
      const data = await graphRequest<{ name?: string; username?: string; profile_pic?: string }>(
        `${externalContactId}?fields=${fields}`,
        { method: "GET", accessToken: token }
      );

      return {
        name: data.name || data.username || externalContactId,
        avatarUrl: data.profile_pic
      };
    }
  };
}
