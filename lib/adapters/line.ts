import { randomUUID } from "node:crypto";
import { hmacSha256Base64, safeEqual } from "@/lib/crypto";
import type {
  AuthorizedChannel,
  ChannelAdapter,
  NormalizedMessage,
  OutboundMessage,
  ParsedWebhook
} from "@/lib/types";

const LINE_API = "https://api.line.me/v2/bot";

type LineEvent = {
  type?: string;
  timestamp?: number;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { id?: string; type?: string; text?: string; fileName?: string };
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
};

function toDate(value: unknown) {
  // LINE timestamps are epoch milliseconds.
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : new Date();
}

/** LINE addresses a user, group, or room — whichever the event originated from. */
function sourceId(source: LineEvent["source"]) {
  return source?.userId || source?.groupId || source?.roomId;
}

function messageBody(message: LineEvent["message"]) {
  if (message?.text) return message.text;
  if (message?.fileName) return message.fileName;
  return message?.type ? `[${message.type}]` : undefined;
}

function accessToken(channel: AuthorizedChannel) {
  const token = channel.credentials.accessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      `No access token for LINE channel "${channel.displayName}". Store one in channels.access_token_encrypted or set LINE_CHANNEL_ACCESS_TOKEN.`
    );
  }
  return token;
}

async function lineRequest<T>(path: string, init: { method: "GET" | "POST"; accessToken: string; body?: unknown }) {
  const response = await fetch(`${LINE_API}/${path.replace(/^\//, "")}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {})
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {})
  });

  const data = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? `LINE Messaging API request failed (${response.status}) for ${path}.`);
  }

  return data;
}

export const lineAdapter: ChannelAdapter = {
  verifyWebhook({ request, rawBody }) {
    const secret = process.env.LINE_CHANNEL_SECRET;
    // Without a channel secret we cannot tell a real LINE callback from a
    // forged one, so we reject rather than trust the payload.
    if (!secret) {
      return false;
    }

    const signature = request.headers.get("x-line-signature");
    if (!signature) {
      return false;
    }

    return safeEqual(hmacSha256Base64(secret, rawBody), signature);
  },
  parseIncoming(payload: any): ParsedWebhook {
    const events: LineEvent[] = Array.isArray(payload?.events) ? payload.events : [];
    // `destination` is the bot's own user id — the LINE equivalent of a Page id.
    const accountId = typeof payload?.destination === "string" ? payload.destination : undefined;

    const messages = events
      .filter(event => event.type === "message" && sourceId(event.source))
      .map((event): NormalizedMessage => ({
        accountId,
        externalContactId: sourceId(event.source) as string,
        body: messageBody(event.message),
        mediaType: event.message?.type === "text" ? undefined : event.message?.type,
        platformMessageId: event.message?.id ?? event.webhookEventId ?? randomUUID(),
        timestamp: toDate(event.timestamp)
      }));

    // LINE has no delivery-receipt webhook; statuses stay empty by design.
    return { messages, statuses: [] };
  },
  async sendMessage(channel: AuthorizedChannel, externalContactId: string, message: OutboundMessage) {
    const data = await lineRequest<{ sentMessages?: Array<{ id?: string }> }>("message/push", {
      method: "POST",
      accessToken: accessToken(channel),
      body: {
        to: externalContactId,
        messages: [{ type: "text", text: message.body }]
      }
    });

    return {
      // LINE only returns sentMessages ids when the bot has the relevant plan;
      // fall back to a local id so the row is still traceable.
      platformMessageId: data.sentMessages?.[0]?.id ?? `line_${randomUUID()}`
    };
  },
  async fetchContactProfile(channel: AuthorizedChannel, externalContactId: string) {
    const data = await lineRequest<{ displayName?: string; pictureUrl?: string }>(
      `profile/${encodeURIComponent(externalContactId)}`,
      { method: "GET", accessToken: accessToken(channel) }
    );

    return {
      name: data.displayName || externalContactId,
      avatarUrl: data.pictureUrl
    };
  }
};
