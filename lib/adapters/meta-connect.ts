import { graphRequest, graphUrl, graphVersion } from "@/lib/adapters/graph";
import type { Platform } from "@/lib/types";

/**
 * The admin-facing half of the Meta integration: the OAuth handshake that turns
 * a Facebook login into Page/Instagram/WhatsApp credentials we can store.
 *
 * Kept apart from `meta.ts`, which only deals with sending and receiving
 * messages once a channel already exists.
 */

/** Every asset the connected Meta user can attach to this workspace. */
export type MetaAsset = {
  platform: Platform;
  externalAccountId: string;
  displayName: string;
  /** Page-scoped or WABA-scoped token to store for this asset. */
  accessToken: string;
  detail?: string;
  /** Page id backing an Instagram asset, needed to subscribe its webhook. */
  parentPageId?: string;
};

const SCOPES = [
  // Messenger
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  // Instagram
  "instagram_basic",
  "instagram_manage_messages",
  // WhatsApp
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management"
];

/** Short-lived cookies that carry the OAuth handshake between redirects. */
export const META_STATE_COOKIE = "unibox_meta_oauth_state";
export const META_TOKEN_COOKIE = "unibox_meta_user_token";

export function metaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function metaRedirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/admin/channels/connect/meta/callback`;
}

export function metaAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: metaRedirectUri(),
    state,
    response_type: "code",
    scope: SCOPES.join(",")
  });

  return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params.toString()}`;
}

/** Trades the one-time code for a user token, then upgrades it to a long-lived one. */
export async function exchangeCodeForUserToken(code: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be set to connect a Meta account.");
  }

  const shortLived = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: metaRedirectUri(),
    code
  });

  const first = await fetch(`${graphUrl("oauth/access_token")}?${shortLived.toString()}`);
  const firstData = (await first.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };

  if (!first.ok || !firstData.access_token) {
    throw new Error(firstData.error?.message ?? "Meta rejected the authorization code.");
  }

  // A short-lived user token expires in about an hour, which would make every
  // stored Page token die with it. The long-lived exchange is what makes the
  // connection last ~60 days.
  const longLived = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: firstData.access_token
  });

  const second = await fetch(`${graphUrl("oauth/access_token")}?${longLived.toString()}`);
  const secondData = (await second.json().catch(() => ({}))) as { access_token?: string };

  return secondData.access_token ?? firstData.access_token;
}

type PagesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string; username?: string; name?: string };
  }>;
};

type BusinessesResponse = { data?: Array<{ id?: string; name?: string }> };
type WabaResponse = { data?: Array<{ id?: string; name?: string }> };
type PhoneNumbersResponse = {
  data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }>;
};

/**
 * Lists everything the connected user can hook up. Each product is queried
 * independently and failures are swallowed per-product: an app without WhatsApp
 * permissions should still be able to connect its Pages.
 */
export async function discoverMetaAssets(userAccessToken: string): Promise<{
  assets: MetaAsset[];
  warnings: string[];
}> {
  const assets: MetaAsset[] = [];
  const warnings: string[] = [];

  try {
    const pages = await graphRequest<PagesResponse>(
      "me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&limit=100",
      { method: "GET", accessToken: userAccessToken }
    );

    for (const page of pages.data ?? []) {
      if (!page.id || !page.access_token) {
        continue;
      }

      assets.push({
        platform: "messenger",
        externalAccountId: page.id,
        displayName: page.name || `Page ${page.id}`,
        accessToken: page.access_token,
        detail: `Page ${page.id}`
      });

      const instagram = page.instagram_business_account;
      if (instagram?.id) {
        assets.push({
          platform: "instagram",
          externalAccountId: instagram.id,
          displayName: instagram.username ? `@${instagram.username}` : instagram.name || `IG ${instagram.id}`,
          // Instagram messaging is authorized with the linked Page's token.
          accessToken: page.access_token,
          detail: `via ${page.name || page.id}`,
          parentPageId: page.id
        });
      }
    }
  } catch (error) {
    warnings.push(
      `Could not list Facebook Pages: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  try {
    const businesses = await graphRequest<BusinessesResponse>("me/businesses?limit=50", {
      method: "GET",
      accessToken: userAccessToken
    });

    for (const business of businesses.data ?? []) {
      if (!business.id) continue;

      const wabas = await graphRequest<WabaResponse>(
        `${business.id}/owned_whatsapp_business_accounts?limit=50`,
        { method: "GET", accessToken: userAccessToken }
      );

      for (const waba of wabas.data ?? []) {
        if (!waba.id) continue;

        const numbers = await graphRequest<PhoneNumbersResponse>(
          `${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=50`,
          { method: "GET", accessToken: userAccessToken }
        );

        for (const number of numbers.data ?? []) {
          if (!number.id) continue;
          assets.push({
            platform: "whatsapp",
            // Cloud API sends to the phone number id, not the WABA id.
            externalAccountId: number.id,
            displayName: number.verified_name || number.display_phone_number || `Number ${number.id}`,
            accessToken: userAccessToken,
            detail: [number.display_phone_number, waba.name].filter(Boolean).join(" · ")
          });
        }
      }
    }
  } catch (error) {
    warnings.push(
      `Could not list WhatsApp numbers: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  return { assets, warnings };
}

/**
 * Subscribes the app to a Page's messaging webhooks. Without this, Meta accepts
 * the connection but never delivers a single message — the most common reason a
 * "connected" Messenger channel stays silent.
 */
export async function subscribePageWebhook(pageId: string, pageAccessToken: string) {
  await graphRequest(`${pageId}/subscribed_apps`, {
    method: "POST",
    accessToken: pageAccessToken,
    body: {
      subscribed_fields: [
        "messages",
        "messaging_postbacks",
        "message_deliveries",
        "message_reads"
      ].join(",")
    }
  });
}
