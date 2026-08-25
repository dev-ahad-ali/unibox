import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapter } from "@/lib/adapters";
import type { AuthorizedChannel } from "@/lib/types";

function channel(platform: AuthorizedChannel["platform"], overrides?: Partial<AuthorizedChannel>): AuthorizedChannel {
  return {
    id: "chan-1",
    orgId: "org-1",
    platform,
    displayName: "Test channel",
    externalAccountId: "account-1",
    status: "active",
    createdAt: new Date(0).toISOString(),
    credentials: { accessToken: "stored-token" },
    ...overrides
  };
}

function mockFetchOnce(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whatsapp sendMessage", () => {
  it("posts to the phone number id with the stored token and returns the wamid", async () => {
    const fetchMock = mockFetchOnce(200, { messages: [{ id: "wamid.Out1" }] });
    const adapter = getAdapter("whatsapp");

    const result = await adapter.sendMessage(
      channel("whatsapp", { externalAccountId: "1191055487432454" }),
      "8801940192494",
      { body: "Hello back" }
    );

    expect(result.platformMessageId).toBe("wamid.Out1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("graph.facebook.com");
    expect(String(url)).toContain("1191055487432454/messages");
    expect(init.headers.Authorization).toBe("Bearer stored-token");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      messaging_product: "whatsapp",
      to: "8801940192494",
      type: "text",
      text: { body: "Hello back" }
    });
  });

  it("throws with the platform's error message on rejection, so no bubble is stored", async () => {
    mockFetchOnce(400, {
      error: { message: "(#131030) Recipient phone number not in allowed list", code: 131030 }
    });
    const adapter = getAdapter("whatsapp");

    await expect(
      adapter.sendMessage(channel("whatsapp"), "8801940192494", { body: "Hello" })
    ).rejects.toThrow(/131030/);
  });
});

describe("messenger sendMessage", () => {
  it("posts to the Page id as a RESPONSE and returns the message id", async () => {
    const fetchMock = mockFetchOnce(200, { message_id: "m_Out1", recipient_id: "24680" });
    const adapter = getAdapter("messenger");

    const result = await adapter.sendMessage(
      channel("messenger", { externalAccountId: "1563194670199327" }),
      "24680135791234567",
      { body: "Reply text" }
    );

    expect(result.platformMessageId).toBe("m_Out1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("1563194670199327/messages");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      recipient: { id: "24680135791234567" },
      messaging_type: "RESPONSE",
      message: { text: "Reply text" }
    });
  });

  it("throws when the API succeeds but returns no message id", async () => {
    mockFetchOnce(200, {});
    const adapter = getAdapter("messenger");

    await expect(
      adapter.sendMessage(channel("messenger"), "24680", { body: "x" })
    ).rejects.toThrow(/no message_id/);
  });
});

describe("line sendMessage", () => {
  it("pushes to the contact with the stored token", async () => {
    const fetchMock = mockFetchOnce(200, { sentMessages: [{ id: "line-msg-1" }] });
    const adapter = getAdapter("line");

    const result = await adapter.sendMessage(
      channel("line"),
      "Uabcdef1234567890abcdef1234567890",
      { body: "Hi!" }
    );

    expect(result.platformMessageId).toBe("line-msg-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.line.me/v2/bot/message/push");
    expect(init.headers.Authorization).toBe("Bearer stored-token");
    expect(JSON.parse(init.body)).toEqual({
      to: "Uabcdef1234567890abcdef1234567890",
      messages: [{ type: "text", text: "Hi!" }]
    });
  });

  it("falls back to a local id when LINE returns no sentMessages", async () => {
    mockFetchOnce(200, {});
    const adapter = getAdapter("line");

    const result = await adapter.sendMessage(channel("line"), "U1", { body: "Hi" });
    expect(result.platformMessageId).toMatch(/^line_/);
  });

  it("surfaces LINE error messages", async () => {
    mockFetchOnce(401, { message: "Authentication failed" });
    const adapter = getAdapter("line");

    await expect(adapter.sendMessage(channel("line"), "U1", { body: "Hi" })).rejects.toThrow(
      /Authentication failed/
    );
  });
});
