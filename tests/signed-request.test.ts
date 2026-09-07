import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "@/lib/signed-request";

/**
 * Meta's `signed_request` is the only thing authenticating the data deletion
 * callback, so the security property under test is that a token only parses
 * under the secret that actually signed it.
 */

const SECRET = "app-secret";
const OTHER_SECRET = "another-tenant-secret";

function base64Url(value: Buffer | string) {
  return (typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest();
  return `${base64Url(signature)}.${encodedPayload}`;
}

const validPayload = {
  algorithm: "HMAC-SHA256",
  issued_at: 1_757_000_000,
  user_id: "1234567890"
};

describe("parseSignedRequest", () => {
  it("returns the payload when the secret matches", () => {
    expect(parseSignedRequest(sign(validPayload, SECRET), SECRET)).toMatchObject({
      user_id: "1234567890"
    });
  });

  it("rejects a token signed by another tenant's app secret", () => {
    expect(parseSignedRequest(sign(validPayload, OTHER_SECRET), SECRET)).toBeNull();
  });

  it("rejects a payload edited after signing", () => {
    const [signature] = sign(validPayload, SECRET).split(".");
    const tampered = base64Url(JSON.stringify({ ...validPayload, user_id: "9999999999" }));
    expect(parseSignedRequest(`${signature}.${tampered}`, SECRET)).toBeNull();
  });

  it("rejects an algorithm we did not verify", () => {
    const token = sign({ ...validPayload, algorithm: "RSA-SHA256" }, SECRET);
    expect(parseSignedRequest(token, SECRET)).toBeNull();
  });

  it("rejects a token with no user_id, which there is nothing to delete for", () => {
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }, SECRET), SECRET)).toBeNull();
  });

  it("returns null rather than throwing on malformed input", () => {
    for (const value of ["", ".", "not-a-token", "a.b.c", `${base64Url("x")}.@@@`]) {
      expect(parseSignedRequest(value, SECRET)).toBeNull();
    }
  });
});
