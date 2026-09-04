import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import type { WebhookContext } from "@/lib/types";

/**
 * Shared Meta Graph client. Messenger, Instagram, and WhatsApp Cloud API all
 * run on this surface and are signed by the same app secret, so the transport,
 * signature check, and error shape live here once.
 */

// Latest released Graph version as of 2026-08. Anything above v26.0 is not
// recognized by graph.facebook.com and the version segment gets parsed as part
// of the path instead, producing a confusing "Unknown path components" error.
export const DEFAULT_GRAPH_VERSION = "v26.0";

export function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
}

export function graphUrl(path: string, host: GraphHost = "facebook") {
  return `https://graph.${host}.com/${graphVersion()}/${path.replace(/^\//, "")}`;
}

/**
 * Meta runs two Graph surfaces: graph.facebook.com for Page-scoped (EAA…)
 * tokens, and graph.instagram.com for the newer "Instagram API with Instagram
 * Login" (IGAA…) tokens. Sending a token to the wrong host fails with
 * "Cannot parse access token", so callers pick the host per token.
 */
export type GraphHost = "facebook" | "instagram";

type GraphError = { error?: { message?: string; code?: number; type?: string } };

export async function graphRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; accessToken: string; body?: unknown; host?: GraphHost }
): Promise<T> {
  const response = await fetch(graphUrl(path, init.host), {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {})
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {})
  });

  const data = (await response.json().catch(() => ({}))) as T & GraphError;

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? `Meta Graph API request failed (${response.status}) for ${path}.`
    );
  }

  return data;
}

/**
 * Meta signs every webhook callback with the app secret using
 * `X-Hub-Signature-256`. Verification is mandatory whenever a secret is
 * configured; without one we refuse the payload rather than accept it, because
 * an unsigned webhook endpoint lets anyone inject messages into the inbox.
 */
export function verifyMetaSignature({ request, rawBody }: WebhookContext) {
  // The Instagram-Login product signs its webhooks with its own "Instagram app
  // secret", which differs from the Meta app secret shown on the app's Basic
  // Settings page. Accept a payload signed by either configured secret.
  const secrets = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (secrets.length === 0) {
    return false;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const received = signature.slice("sha256=".length);
  return secrets.some(secret => safeEqual(hmacSha256Hex(secret, rawBody), received));
}

/** Handles the `hub.challenge` GET that Meta sends when you subscribe a webhook. */
export function handleMetaVerification(request: Request, expectedToken: string | undefined) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");

  if (!expectedToken) {
    return new Response("Webhook verify token is not configured on this server", { status: 500 });
  }

  if (mode !== "subscribe" || !challenge || !verifyToken || !safeEqual(expectedToken, verifyToken)) {
    return new Response("Invalid verify token", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}
