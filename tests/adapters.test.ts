import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdapter } from "@/lib/adapters";
import {
  linePayload,
  lineVerifyPayload,
  messengerPayload,
  messengerReadPayload,
  whatsappImagePayload,
  whatsappPayload
} from "./fixtures";
import { lineSignedContext, metaSignedContext } from "./helpers";

const META_APP_SECRET = "test-meta-app-secret";
const LINE_CHANNEL_SECRET = "test-line-channel-secret";

const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ["META_APP_SECRET", "LINE_CHANNEL_SECRET"]) {
    envBackup[key] = process.env[key];
  }
  process.env.META_APP_SECRET = META_APP_SECRET;
  process.env.LINE_CHANNEL_SECRET = LINE_CHANNEL_SECRET;
});

afterEach(() => {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("meta signature verification (messenger/instagram/whatsapp)", () => {
  const adapter = getAdapter("messenger");
  const body = JSON.stringify(messengerPayload);

  it("accepts a payload signed with the app secret", () => {
    expect(adapter.verifyWebhook(metaSignedContext(body, META_APP_SECRET))).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(adapter.verifyWebhook(metaSignedContext(body, META_APP_SECRET, true))).toBe(false);
  });

  it("rejects a payload signed with the wrong secret", () => {
    expect(adapter.verifyWebhook(metaSignedContext(body, "attacker-secret"))).toBe(false);
  });

  it("rejects everything when META_APP_SECRET is unset", () => {
    delete process.env.META_APP_SECRET;
    expect(adapter.verifyWebhook(metaSignedContext(body, META_APP_SECRET))).toBe(false);
  });

  it("rejects a request with no signature header", () => {
    const context = {
      request: new Request("https://example.test", { method: "POST", body }),
      rawBody: body
    };
    expect(adapter.verifyWebhook(context)).toBe(false);
  });
});

describe("messenger parseIncoming", () => {
  const adapter = getAdapter("messenger");

  it("normalizes an inbound text and routes it by Page id", () => {
    const { messages } = adapter.parseIncoming(messengerPayload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      accountId: "1563194670199327",
      externalContactId: "24680135791234567",
      body: "Hello from a customer",
      platformMessageId: "m_AbCdEf123"
    });
    expect(messages[0].timestamp.getTime()).toBe(1756100000000);
  });

  it("drops echo events so agent replies are not re-ingested as customer messages", () => {
    const { messages } = adapter.parseIncoming(messengerPayload);
    expect(messages.map(m => m.platformMessageId)).not.toContain("m_EchoXyz");
  });

  it("turns delivery mids into delivered statuses", () => {
    const { statuses } = adapter.parseIncoming(messengerPayload);
    expect(statuses).toEqual([
      expect.objectContaining({ platformMessageId: "m_SentEarlier1", status: "delivered" })
    ]);
  });

  it("ignores read watermarks", () => {
    const { messages, statuses } = adapter.parseIncoming(messengerReadPayload);
    expect(messages).toHaveLength(0);
    expect(statuses).toHaveLength(0);
  });

  it("returns nothing for a payload with no entries", () => {
    const { messages, statuses } = adapter.parseIncoming({});
    expect(messages).toHaveLength(0);
    expect(statuses).toHaveLength(0);
  });
});

describe("whatsapp parseIncoming", () => {
  const adapter = getAdapter("whatsapp");

  it("routes by phone_number_id and picks up the contact profile name", () => {
    const { messages } = adapter.parseIncoming(whatsappPayload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      accountId: "1191055487432454",
      externalContactId: "8801940192494",
      contactName: "Baizyd Bustami",
      body: "Hello",
      platformMessageId: "wamid.HBgNODgwMTk0MDE5MjQ5NBUCABIYFj"
    });
  });

  it("converts epoch-second timestamps to milliseconds", () => {
    const { messages } = adapter.parseIncoming(whatsappPayload);
    expect(messages[0].timestamp.getTime()).toBe(1756100000 * 1000);
  });

  it("maps status updates onto our delivery states", () => {
    const { statuses } = adapter.parseIncoming(whatsappPayload);
    expect(statuses).toEqual([
      expect.objectContaining({
        accountId: "1191055487432454",
        platformMessageId: "wamid.OutboundReply1",
        status: "read"
      })
    ]);
  });

  it("rewrites media ids to the proxy route and keeps the caption as body", () => {
    const { messages } = adapter.parseIncoming(whatsappImagePayload);
    expect(messages[0]).toMatchObject({
      body: "look at this",
      mediaUrl: "/api/media/whatsapp/media-id-987",
      mediaType: "image/jpeg"
    });
  });
});

describe("line signature verification", () => {
  const adapter = getAdapter("line");
  const body = JSON.stringify(linePayload);

  it("accepts a payload signed with the channel secret", () => {
    expect(adapter.verifyWebhook(lineSignedContext(body, LINE_CHANNEL_SECRET))).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(adapter.verifyWebhook(lineSignedContext(body, LINE_CHANNEL_SECRET, true))).toBe(false);
  });

  it("rejects everything when LINE_CHANNEL_SECRET is unset", () => {
    delete process.env.LINE_CHANNEL_SECRET;
    expect(adapter.verifyWebhook(lineSignedContext(body, LINE_CHANNEL_SECRET))).toBe(false);
  });

  it("prefers the per-channel secret over the env fallback", () => {
    const perChannel = "channel-specific-secret";
    const signedForChannel = { ...lineSignedContext(body, perChannel), secret: perChannel };
    expect(adapter.verifyWebhook(signedForChannel)).toBe(true);

    // Signed with the env secret but a different per-channel secret provided:
    // the channel's own secret must win, so verification fails.
    const signedForEnv = { ...lineSignedContext(body, LINE_CHANNEL_SECRET), secret: perChannel };
    expect(adapter.verifyWebhook(signedForEnv)).toBe(false);
  });

  it("extracts the destination as the routing account id", () => {
    expect(adapter.webhookAccountId?.(linePayload, lineSignedContext(body, "x").request)).toBe(
      "U67890abcdef1234567890abcdef1234"
    );
  });

  it("accepts the Verify-button probe (signed, empty events)", () => {
    const probe = JSON.stringify(lineVerifyPayload);
    expect(adapter.verifyWebhook(lineSignedContext(probe, LINE_CHANNEL_SECRET))).toBe(true);
    const { messages, statuses } = adapter.parseIncoming(lineVerifyPayload);
    expect(messages).toHaveLength(0);
    expect(statuses).toHaveLength(0);
  });
});

describe("line parseIncoming", () => {
  const adapter = getAdapter("line");

  it("routes by destination (bot user id) and normalizes the text event", () => {
    const { messages, statuses } = adapter.parseIncoming(linePayload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      accountId: "U67890abcdef1234567890abcdef1234",
      externalContactId: "Uabcdef1234567890abcdef1234567890",
      body: "Hi from LINE",
      platformMessageId: "585814919846445465"
    });
    // LINE has no delivery receipts.
    expect(statuses).toHaveLength(0);
  });

  it("skips non-message events like follow", () => {
    const { messages } = adapter.parseIncoming(linePayload);
    expect(messages).toHaveLength(1);
  });
});
