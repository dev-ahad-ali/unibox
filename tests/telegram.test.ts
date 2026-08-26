import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapter } from "@/lib/adapters";
import type { AuthorizedChannel } from "@/lib/types";

const adapter = getAdapter("telegram");

const update = {
  update_id: 987654321,
  message: {
    message_id: 42,
    from: { id: 111222333, first_name: "Ahad", username: "ahad_dev" },
    chat: { id: 111222333, type: "private", first_name: "Ahad" },
    date: 1756100000,
    text: "Hello bot"
  }
};

function contextWithSecret(headerValue: string | null, secret?: string | null) {
  const headers: Record<string, string> = {};
  if (headerValue !== null) {
    headers["x-telegram-bot-api-secret-token"] = headerValue;
  }
  return {
    request: new Request("https://example.test/api/webhooks/telegram?account=7000000001", {
      method: "POST",
      headers,
      body: JSON.stringify(update)
    }),
    rawBody: JSON.stringify(update),
    secret
  };
}

function channel(overrides?: Partial<AuthorizedChannel>): AuthorizedChannel {
  return {
    id: "chan-tg",
    orgId: "org-1",
    platform: "telegram",
    displayName: "Test bot",
    externalAccountId: "7000000001",
    status: "active",
    createdAt: new Date(0).toISOString(),
    credentials: { accessToken: "7000000001:AAExampleBotToken" },
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("telegram verifyWebhook", () => {
  it("accepts when the header matches the channel secret", () => {
    expect(adapter.verifyWebhook(contextWithSecret("s3cret", "s3cret"))).toBe(true);
  });

  it("rejects a wrong header", () => {
    expect(adapter.verifyWebhook(contextWithSecret("wrong", "s3cret"))).toBe(false);
  });

  it("rejects when no header is sent", () => {
    expect(adapter.verifyWebhook(contextWithSecret(null, "s3cret"))).toBe(false);
  });

  it("rejects everything when no secret is configured anywhere", () => {
    expect(adapter.verifyWebhook(contextWithSecret("anything", null))).toBe(false);
  });
});

describe("telegram webhookAccountId", () => {
  it("reads the bot id from the webhook URL", () => {
    const { request } = contextWithSecret("x", "x");
    expect(adapter.webhookAccountId?.(update, request)).toBe("7000000001");
  });
});

describe("telegram parseIncoming", () => {
  it("normalizes a private-chat text message", () => {
    const { messages, statuses } = adapter.parseIncoming(update);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      externalContactId: "111222333",
      contactName: "Ahad",
      body: "Hello bot",
      platformMessageId: "tg_111222333_42"
    });
    expect(messages[0].timestamp.getTime()).toBe(1756100000 * 1000);
    expect(statuses).toHaveLength(0);
  });

  it("ignores updates without a message", () => {
    const { messages } = adapter.parseIncoming({ update_id: 1 });
    expect(messages).toHaveLength(0);
  });
});

describe("telegram sendMessage", () => {
  it("posts to the bot's sendMessage endpoint and returns a per-chat id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 43 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.sendMessage(channel(), "111222333", { body: "Reply" });
    expect(result.platformMessageId).toBe("tg_111222333_43");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.telegram.org/bot7000000001:AAExampleBotToken/sendMessage"
    );
    expect(JSON.parse(init.body)).toEqual({ chat_id: "111222333", text: "Reply" });
  });

  it("surfaces Telegram error descriptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }),
          { status: 403 }
        )
      )
    );

    await expect(adapter.sendMessage(channel(), "111222333", { body: "x" })).rejects.toThrow(
      /blocked by the user/
    );
  });
});

describe("telegram verifyCredentials", () => {
  it("rejects a token that belongs to a different bot id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, result: { id: 9999, first_name: "Other", username: "other_bot" } }),
          { status: 200 }
        )
      )
    );

    await expect(adapter.verifyCredentials(channel())).rejects.toThrow(/belongs to bot id 9999/);
  });
});
