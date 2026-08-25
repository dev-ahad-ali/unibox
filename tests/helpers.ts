import { hmacSha256Base64, hmacSha256Hex } from "@/lib/crypto";

/**
 * Builds the WebhookContext the adapters receive: a Request carrying the
 * signature header, plus the raw body string the signature was computed over.
 */
export function metaSignedContext(rawBody: string, appSecret: string, tamper = false) {
  const signature = `sha256=${hmacSha256Hex(appSecret, rawBody)}`;
  return {
    request: new Request("https://example.test/api/webhooks/meta", {
      method: "POST",
      headers: { "x-hub-signature-256": tamper ? `${signature}0` : signature },
      body: rawBody
    }),
    rawBody
  };
}

export function lineSignedContext(rawBody: string, channelSecret: string, tamper = false) {
  const signature = hmacSha256Base64(channelSecret, rawBody);
  return {
    request: new Request("https://example.test/api/webhooks/line", {
      method: "POST",
      headers: { "x-line-signature": tamper ? `x${signature.slice(1)}` : signature },
      body: rawBody
    }),
    rawBody
  };
}
