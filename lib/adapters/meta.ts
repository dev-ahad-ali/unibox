import { randomUUID } from "node:crypto";
import { graphRequest, verifyMetaSignature, type GraphHost } from "@/lib/adapters/graph";
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
  // Per-channel only: env-var token fallbacks made one tenant's credential a
  // silent default for every other tenant's channel.
  const token = channel.credentials.accessToken;
  if (!token) {
    throw new Error(
      `No access token stored for ${platform} channel "${channel.displayName}". Reconnect it from /admin/channels.`
    );
  }

  return token;
}

/**
 * Instagram supports two token flavours. Page tokens ("Instagram API with
 * Facebook Login") start with EAA and talk to graph.facebook.com; tokens from
 * the newer "Instagram API with Instagram Login" product start with IGAA and
 * only work against graph.instagram.com. The prefix decides the host, so a
 * channel connected with either flavour just works.
 */
function hostFor(token: string): GraphHost {
  return token.startsWith("IG") ? "instagram" : "facebook";
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
    /**
     * `entry[].id` is the Page id (Messenger) or the professional account id
     * (Instagram). Exposing it lets the pipeline resolve the addressed
     * organization, and so its Meta app secret, before the signature is
     * checked — without it every tenant's secret would be a candidate.
     */
    webhookAccountId(payload: any) {
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      const id = entries.find((entry: any) => typeof entry?.id === "string")?.id;
      return typeof id === "string" ? id : undefined;
    },
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
          host: hostFor(token),
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
    async verifyCredentials(channel: AuthorizedChannel) {
      const token = accessToken(channel, platform);

      if (platform === "instagram" && hostFor(token) === "instagram") {
        // Instagram-Login tokens can only introspect themselves via /me.
        // `user_id` is the professional account id that arrives as `entry.id`
        // on webhooks — the id the channel must be stored under for routing.
        const data = await graphRequest<{ id?: string; user_id?: string; username?: string; name?: string }>(
          "me?fields=user_id,username,name",
          { method: "GET", accessToken: token, host: "instagram" }
        );

        const actualId = data.user_id ?? data.id;
        if (actualId && actualId !== channel.externalAccountId) {
          throw new Error(
            `This token belongs to Instagram account id ${actualId} (@${data.username ?? "unknown"}), not ${channel.externalAccountId}. Use ${actualId} as the account id.`
          );
        }

        return { label: data.name || data.username || channel.externalAccountId };
      }

      const fields = platform === "instagram" ? "id,username,name" : "id,name";
      const data = await graphRequest<{ id?: string; name?: string; username?: string }>(
        `${channel.externalAccountId}?fields=${fields}`,
        { method: "GET", accessToken: token }
      );

      return { label: data.name || data.username || data.id || channel.externalAccountId };
    },
    async fetchContactProfile(channel: AuthorizedChannel, externalContactId: string) {
      const token = accessToken(channel, platform);
      const fields = platform === "instagram" ? "name,username,profile_pic" : "name,profile_pic";
      const data = await graphRequest<{ name?: string; username?: string; profile_pic?: string }>(
        `${externalContactId}?fields=${fields}`,
        { method: "GET", accessToken: token, host: hostFor(token) }
      );

      return {
        name: data.name || data.username || externalContactId,
        avatarUrl: data.profile_pic
      };
    }
  };
}
