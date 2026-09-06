import { createServiceClient } from "@/lib/supabase";
import {
  getMetaCredentialsForEvent,
  getStoredMetaCredentials,
  listStoredMetaVerifyTokens
} from "@/lib/store";
import type { MetaCredentials, MetaCredentialsSummary, Platform } from "@/lib/types";

/**
 * Resolves which Meta developer app a request belongs to.
 *
 * Credentials live on the organization (entered at /admin/credentials) so a
 * single deployment can serve tenants that each bring their own Meta app. The
 * deployment-level env vars remain as a fallback, which is what keeps a
 * single-tenant install — and any workspace that has not filled the form in yet
 * — working unchanged.
 */

/** Platforms authorized by a Meta developer app. */
export const META_PLATFORMS = ["messenger", "instagram", "whatsapp"] as const;

export function isMetaPlatform(platform: Platform) {
  return (META_PLATFORMS as readonly Platform[]).includes(platform);
}

/** Query parameter that names the organization a webhook is addressed to. */
export const ORG_QUERY_PARAM = "org";

export function orgIdFromRequest(request: Request): string | undefined {
  try {
    return new URL(request.url).searchParams.get(ORG_QUERY_PARAM) || undefined;
  } catch {
    return undefined;
  }
}

/** Deployment-wide credentials. Operator-owned, shared by every org that has none. */
export function envMetaCredentials(): MetaCredentials {
  return {
    appId: process.env.META_APP_ID || undefined,
    appSecret: process.env.META_APP_SECRET || undefined,
    verifyToken: process.env.META_VERIFY_TOKEN || undefined,
    instagramAppSecret: process.env.INSTAGRAM_APP_SECRET || undefined
  };
}

export function hasEnvMetaCredentials() {
  const env = envMetaCredentials();
  return Boolean(env.appId || env.appSecret || env.verifyToken);
}

/**
 * The credentials to use for an organization: its own values, falling back
 * field by field to the deployment's. Field-level rather than all-or-nothing so
 * an org can override just the app id and secret while still using the
 * operator's verify token.
 *
 * Reads encrypted columns, so it runs on the service client — those columns are
 * revoked from the authenticated role. Callers must have already established
 * that the caller may act for `orgId`.
 */
export async function getMetaCredentials(orgId: string): Promise<MetaCredentials> {
  const stored = await getStoredMetaCredentials(createServiceClient(), orgId);
  const env = envMetaCredentials();

  return {
    appId: stored?.appId || env.appId,
    appSecret: stored?.appSecret || env.appSecret,
    verifyToken: stored?.verifyToken || env.verifyToken,
    instagramAppSecret: stored?.instagramAppSecret || env.instagramAppSecret
  };
}

/** True when this org can run the one-click Meta OAuth connect. */
export async function isMetaConfigured(orgId: string) {
  const credentials = await getMetaCredentials(orgId);
  return Boolean(credentials.appId && credentials.appSecret);
}

/** What the credentials screen renders: identifiers and set/unset flags only. */
export async function getMetaCredentialsSummary(orgId: string): Promise<MetaCredentialsSummary> {
  const stored = await getStoredMetaCredentials(createServiceClient(), orgId);
  const env = envMetaCredentials();

  return {
    appId: stored?.appId || env.appId,
    verifyToken: stored?.verifyToken || env.verifyToken,
    hasAppSecret: Boolean(stored?.appSecret || env.appSecret),
    hasInstagramAppSecret: Boolean(stored?.instagramAppSecret || env.instagramAppSecret),
    updatedAt: stored?.updatedAt,
    fromEnvironment: !stored?.appSecret && Boolean(env.appSecret)
  };
}

/**
 * The app secrets a Meta webhook may legitimately be signed with.
 *
 * The organization is resolved *before* the signature is checked — from the
 * `?org=` parameter on the callback URL, or failing that from the channel the
 * payload addresses. Verifying against only that org's secret is what stops one
 * tenant from signing a payload aimed at another tenant's Page id.
 */
export async function resolveMetaAppSecrets(
  platform: Platform,
  request: Request,
  accountId?: string
): Promise<string[]> {
  const db = createServiceClient();
  const orgId = orgIdFromRequest(request);

  const credentials = orgId
    ? await getStoredMetaCredentials(db, orgId)
    : await getMetaCredentialsForEvent(db, platform, accountId);

  const env = envMetaCredentials();

  // The operator's own app secret stays valid everywhere: it is the deployment
  // owner's app, and dropping it would break every channel connected before
  // credentials moved into the database.
  return [
    credentials?.appSecret,
    credentials?.instagramAppSecret,
    env.appSecret,
    env.instagramAppSecret
  ].filter((secret): secret is string => Boolean(secret));
}

/**
 * Verify tokens to accept for Meta's `hub.challenge` handshake.
 *
 * A verification GET carries no account id, so an unscoped callback URL leaves
 * nothing to route on and every tenant's token is a candidate. Point Meta at a
 * `?org=` URL — which is what the setup guide hands out — to narrow it to one.
 */
export async function resolveMetaVerifyTokens(request: Request): Promise<string[]> {
  const db = createServiceClient();
  const orgId = orgIdFromRequest(request);
  const env = envMetaCredentials();

  const envTokens = [
    process.env.WHATSAPP_VERIFY_TOKEN || undefined,
    env.verifyToken
  ].filter((token): token is string => Boolean(token));

  if (orgId) {
    const stored = await getStoredMetaCredentials(db, orgId);
    return [stored?.verifyToken, ...envTokens].filter((token): token is string => Boolean(token));
  }

  return [...(await listStoredMetaVerifyTokens(db)), ...envTokens];
}
