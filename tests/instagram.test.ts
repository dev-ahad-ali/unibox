import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdapter } from "@/lib/adapters";
import type { AuthorizedChannel } from "@/lib/types";
import { messengerPayload } from "./fixtures";
import { metaSignedContext } from "./helpers";

const adapter = getAdapter("instagram");

const IG_ACCOUNT_ID = "17841400000000000";

function channel(accessToken: string): AuthorizedChannel {
  return {
    id: "chan-ig",
    orgId: "org-1",
    platform: "instagram",
    displayName: "IG shop",
    externalAccountId: IG_ACCOUNT_ID,
    status: "active",
    createdAt: new Date(0).toISOString(),
    credentials: { accessToken }
  };
}

const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ["META_APP_SECRET", "INSTAGRAM_APP_SECRET"]) {
    envBackup[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("instagram token-flavour host routing", () => {
  it("sends via graph.instagram.com when the token is an Instagram-Login (IGAA) token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_id: "mid.igaa1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.sendMessage(channel("IGAAExampleToken"), "1234567890", {
      body: "Hi"
    });
    expect(result.platformMessageId).toBe("mid.igaa1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://graph.instagram.com/");
    expect(String(url)).toContain(`/${IG_ACCOUNT_ID}/messages`);
  });

  it("sends via graph.facebook.com when the token is a Page (EAA) token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_id: "mid.eaa1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await adapter.sendMessage(channel("EAAExamplePageToken"), "1234567890", { body: "Hi" });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://graph.facebook.com/");
  });
});

describe("instagram verifyCredentials with an Instagram-Login token", () => {
  it("introspects the token via /me and accepts a matching account id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "app-scoped-id", user_id: IG_ACCOUNT_ID, username: "shop", name: "Shop" }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.verifyCredentials?.(channel("IGAAExampleToken"));
    expect(result?.label).toBe("Shop");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://graph.instagram.com/");
    expect(String(url)).toContain("me?fields=user_id");
  });

  it("rejects a token whose account id does not match, naming the right id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: "x", user_id: "17849999999999999", username: "othershop" }),
          { status: 200 }
        )
      )
    );

    await expect(adapter.verifyCredentials?.(channel("IGAAExampleToken"))).rejects.toThrow(
      /17849999999999999/
    );
  });
});

describe("instagram webhook signature with INSTAGRAM_APP_SECRET", () => {
  const body = JSON.stringify(messengerPayload);

  it("accepts a payload signed with the Instagram app secret when configured", () => {
    process.env.META_APP_SECRET = "meta-secret";
    process.env.INSTAGRAM_APP_SECRET = "instagram-secret";
    expect(adapter.verifyWebhook(metaSignedContext(body, "instagram-secret"))).toBe(true);
    expect(adapter.verifyWebhook(metaSignedContext(body, "meta-secret"))).toBe(true);
  });

  it("still rejects a payload signed with neither secret", () => {
    process.env.META_APP_SECRET = "meta-secret";
    process.env.INSTAGRAM_APP_SECRET = "instagram-secret";
    expect(adapter.verifyWebhook(metaSignedContext(body, "attacker-secret"))).toBe(false);
  });

  it("rejects everything when no secret is configured at all", () => {
    expect(adapter.verifyWebhook(metaSignedContext(body, "instagram-secret"))).toBe(false);
  });
});
