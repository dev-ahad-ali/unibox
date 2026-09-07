import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta's `signed_request`, the envelope behind the Data Deletion Request
 * Callback and the older login flows.
 *
 * Shape is `base64url(hmac_sha256(encodedPayload, appSecret)).base64url(json)`.
 * The signature covers the *encoded* payload string, not the decoded JSON, so
 * the halves must be verified before either is parsed.
 *
 * Separate from `verifyMetaSignature` in adapters/graph.ts: that one checks an
 * `X-Hub-Signature-256` header against a raw body, this one is a self-contained
 * token in a form field.
 */

export type SignedRequestPayload = {
  algorithm?: string;
  issued_at?: number;
  /** App-scoped id of the person who asked for deletion. */
  user_id?: string;
};

function base64UrlDecode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Returns the payload when `secret` produced the signature, otherwise null.
 * Never throws: a malformed token is an untrusted input, not an exception.
 */
export function parseSignedRequest(
  signedRequest: string,
  secret: string
): SignedRequestPayload | null {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedSignature, encodedPayload] = parts;
  if (!encodedSignature || !encodedPayload) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  const received = base64UrlDecode(encodedSignature);

  // timingSafeEqual throws on a length mismatch, and digest length is not secret.
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8")
    ) as SignedRequestPayload;

    // Meta writes "HMAC-SHA256"; refuse anything else rather than trusting a
    // token that names an algorithm we did not just verify.
    if (payload.algorithm?.toUpperCase().replace(/[-_]/g, "") !== "HMACSHA256") {
      return null;
    }

    return typeof payload.user_id === "string" && payload.user_id ? payload : null;
  } catch {
    return null;
  }
}
