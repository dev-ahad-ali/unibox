import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdapter } from "@/lib/adapters";
import { handleMetaVerification } from "@/lib/adapters/graph";
import { messengerPayload, whatsappPayload } from "./fixtures";
import { metaSignedContext } from "./helpers";

/**
 * Per-organization Meta app credentials. The security property under test is
 * that a payload is only accepted when it is signed by the app secret of the
 * organization it is addressed to — one tenant's app must not be able to inject
 * messages into another's inbox.
 */

const ORG_A_SECRET = "org-a-app-secret";
const ORG_B_SECRET = "org-b-app-secret";

const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ["META_APP_SECRET", "INSTAGRAM_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "META_VERIFY_TOKEN"]) {
    envBackup[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("meta signature verification against per-org secrets", () => {
  const adapter = getAdapter("messenger");
  const body = JSON.stringify(messengerPayload);

  it("accepts a payload signed with the addressed org's app secret", () => {
    const context = { ...metaSignedContext(body, ORG_A_SECRET), appSecrets: [ORG_A_SECRET] };
    expect(adapter.verifyWebhook(context)).toBe(true);
  });

  it("rejects a payload signed by a different tenant's app secret", () => {
    // Org B signs a payload naming org A's Page id. Only org A's secret is a
    // candidate, so it must not be ingested.
    const context = { ...metaSignedContext(body, ORG_B_SECRET), appSecrets: [ORG_A_SECRET] };
    expect(adapter.verifyWebhook(context)).toBe(false);
  });

  it("rejects when the addressed account resolves to no credentials", () => {
    const context = { ...metaSignedContext(body, ORG_A_SECRET), appSecrets: [] };
    expect(adapter.verifyWebhook(context)).toBe(false);
  });

  it("accepts either the app secret or the org's Instagram app secret", () => {
    const instagram = getAdapter("instagram");
    const secrets = [ORG_A_SECRET, "org-a-instagram-secret"];
    expect(
      instagram.verifyWebhook({ ...metaSignedContext(body, "org-a-instagram-secret"), appSecrets: secrets })
    ).toBe(true);
    expect(instagram.verifyWebhook({ ...metaSignedContext(body, ORG_A_SECRET), appSecrets: secrets })).toBe(true);
  });

  it("still honours the deployment's env secret, so pre-existing channels keep working", () => {
    process.env.META_APP_SECRET = "operator-secret";
    expect(adapter.verifyWebhook(metaSignedContext(body, "operator-secret"))).toBe(true);
  });
});

describe("meta adapters name the account a webhook addresses", () => {
  it("reads the Page id from entry[].id", () => {
    const request = new Request("https://example.test/api/webhooks/messenger", { method: "POST" });
    expect(getAdapter("messenger").webhookAccountId?.(messengerPayload, request)).toBe(
      "1563194670199327"
    );
  });

  it("reads the phone number id, not the WABA id, for WhatsApp", () => {
    const request = new Request("https://example.test/api/webhooks/whatsapp", { method: "POST" });
    expect(getAdapter("whatsapp").webhookAccountId?.(whatsappPayload, request)).toBe(
      "1191055487432454"
    );
  });

  it("returns undefined for a payload with no entries", () => {
    const request = new Request("https://example.test/api/webhooks/messenger", { method: "POST" });
    expect(getAdapter("messenger").webhookAccountId?.({}, request)).toBeUndefined();
  });
});

describe("hub.challenge handshake with per-org verify tokens", () => {
  const challengeRequest = (token: string) =>
    new Request(
      `https://example.test/api/webhooks/messenger?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=${token}`
    );

  it("echoes the challenge when the token matches one of the candidates", async () => {
    const response = handleMetaVerification(challengeRequest("org-b-token"), [
      "org-a-token",
      "org-b-token"
    ]);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rejects a token no organization uses", () => {
    expect(handleMetaVerification(challengeRequest("guessed"), ["org-a-token"]).status).toBe(403);
  });

  it("answers 500 when no token is configured anywhere", () => {
    expect(handleMetaVerification(challengeRequest("anything"), []).status).toBe(500);
  });

  it("ignores undefined entries in the candidate list", () => {
    const response = handleMetaVerification(challengeRequest("org-a-token"), [
      undefined,
      null,
      "org-a-token"
    ]);
    expect(response.status).toBe(200);
  });

  it("still accepts a single token, the shape the routes used before", () => {
    expect(handleMetaVerification(challengeRequest("solo"), "solo").status).toBe(200);
  });

  it("refuses a request that is not a subscribe handshake", () => {
    const response = handleMetaVerification(
      new Request("https://example.test/api/webhooks/messenger?hub.verify_token=org-a-token"),
      ["org-a-token"]
    );
    expect(response.status).toBe(403);
  });
});
