import { safeEqual } from "@/lib/crypto";
import type {
  AuthorizedChannel,
  ChannelAdapter,
  NormalizedMessage,
  OutboundMessage,
  ParsedWebhook
} from "@/lib/types";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id?: number;
  from?: TelegramUser;
  chat?: { id?: number; type?: string; first_name?: string; last_name?: string; username?: string };
  date?: number;
  text?: string;
  caption?: string;
  photo?: unknown;
  document?: { file_name?: string };
  voice?: unknown;
  video?: unknown;
  sticker?: { emoji?: string };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

/** Telegram timestamps are epoch seconds. */
function toDate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : new Date();
}

function displayName(user?: TelegramUser) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return name || (user?.username ? `@${user.username}` : undefined);
}

function messageBody(message: TelegramMessage) {
  if (message.text) return message.text;
  if (message.caption) return message.caption;
  if (message.document?.file_name) return message.document.file_name;
  if (message.sticker) return message.sticker.emoji ?? "[sticker]";
  if (message.photo) return "[photo]";
  if (message.voice) return "[voice]";
  if (message.video) return "[video]";
  return undefined;
}

function botToken(channel: AuthorizedChannel) {
  const token = channel.credentials.accessToken;
  if (!token) {
    throw new Error(
      `No bot token for Telegram channel "${channel.displayName}". Reconnect the channel with the token from @BotFather.`
    );
  }
  return token;
}

async function telegramRequest<T>(token: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
  };

  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(data.description ?? `Telegram API request failed (${response.status}) for ${method}.`);
  }

  return data.result;
}

/**
 * Registers the bot's webhook. Called on connect so the admin never touches
 * the Telegram API by hand: paste the token, and updates start flowing.
 * `secretToken` comes back on every update in X-Telegram-Bot-Api-Secret-Token.
 */
export async function registerTelegramWebhook(token: string, url: string, secretToken: string) {
  await telegramRequest<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"]
  });
}

export const telegramAdapter: ChannelAdapter = {
  verifyWebhook({ request, secret }) {
    // Telegram does not sign payloads; it echoes back the secret_token we set
    // on the webhook. No stored secret means we cannot tell Telegram from a
    // forger, so we reject rather than trust the payload.
    const expected = secret || process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
      return false;
    }

    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (!provided) {
      return false;
    }

    return safeEqual(expected, provided);
  },
  // The update body never names the bot it was sent to, so the webhook URL
  // carries it: /api/webhooks/telegram?account=<bot id>, set at registration.
  webhookAccountId(_payload, request) {
    return new URL(request.url).searchParams.get("account") ?? undefined;
  },
  parseIncoming(payload: any): ParsedWebhook {
    const update = payload as TelegramUpdate;
    const message = update?.message;
    const chatId = message?.chat?.id;

    if (!message || chatId === undefined) {
      return { messages: [], statuses: [] };
    }

    const normalized: NormalizedMessage = {
      externalContactId: String(chatId),
      contactName: displayName(message.from) ?? displayName(message.chat),
      body: messageBody(message),
      // Telegram message ids are only unique per chat, so the pair is the key.
      platformMessageId: `tg_${chatId}_${message.message_id ?? update.update_id}`,
      timestamp: toDate(message.date)
    };

    // Telegram has no delivery-receipt webhook; statuses stay empty by design.
    return { messages: [normalized], statuses: [] };
  },
  async sendMessage(channel: AuthorizedChannel, externalContactId: string, message: OutboundMessage) {
    const result = await telegramRequest<{ message_id?: number }>(botToken(channel), "sendMessage", {
      chat_id: externalContactId,
      text: message.body
    });

    return { platformMessageId: `tg_${externalContactId}_${result.message_id}` };
  },
  async verifyCredentials(channel: AuthorizedChannel) {
    const me = await telegramRequest<TelegramUser>(botToken(channel), "getMe");

    // The bot id is the number before the colon in the token; a mismatch means
    // the admin pasted a different bot's token than the id they entered.
    if (channel.externalAccountId && me.id && String(me.id) !== channel.externalAccountId) {
      throw new Error(
        `That token belongs to bot id ${me.id}, not ${channel.externalAccountId}. Use the number before the colon in the token.`
      );
    }

    return { label: [displayName(me), me.username ? `@${me.username}` : null].filter(Boolean).join(" ") || "Telegram bot" };
  },
  async fetchContactProfile(channel: AuthorizedChannel, externalContactId: string) {
    const chat = await telegramRequest<{ first_name?: string; last_name?: string; username?: string }>(
      botToken(channel),
      "getChat",
      { chat_id: externalContactId }
    );

    return {
      name:
        [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
        (chat.username ? `@${chat.username}` : externalContactId)
    };
  }
};
