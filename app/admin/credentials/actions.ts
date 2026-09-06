"use server";

import { revalidatePath } from "next/cache";
import { graphRequest } from "@/lib/adapters/graph";
import { requireRole } from "@/lib/auth";
import { isEncryptionConfigured } from "@/lib/crypto";
import { getMetaCredentials } from "@/lib/meta-app";
import { clearStoredMetaCredentials, saveStoredMetaCredentials } from "@/lib/store";

export type CredentialsActionState = { error?: string; notice?: string };

/**
 * Confirms the app id and secret really belong together before they are stored.
 *
 * `oauth/access_token` with `grant_type=client_credentials` is the cheapest
 * call that exercises both halves: Meta answers with an app token, or rejects
 * the pair outright. Storing an unusable pair would leave a workspace whose
 * Connect button fails every time with an error from deep inside the OAuth
 * redirect, which is a miserable thing to debug.
 */
async function verifyAppCredentials(appId: string, appSecret: string) {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "client_credentials"
  });

  try {
    await graphRequest<{ access_token?: string }>(`oauth/access_token?${params.toString()}`, {
      method: "GET",
      accessToken: `${appId}|${appSecret}`
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "unknown error";
    throw new Error(`Meta rejected this app id and secret: ${detail}`);
  }
}

export async function saveMetaCredentials(
  _state: CredentialsActionState,
  formData: FormData
): Promise<CredentialsActionState> {
  const session = await requireRole(["admin"]);
  if (session.isDemo) {
    return { error: "Saving credentials needs a configured Supabase project." };
  }

  if (!isEncryptionConfigured()) {
    return { error: "Set APP_ENCRYPTION_KEY before storing credentials." };
  }

  const appId = String(formData.get("appId") ?? "").trim();
  const appSecret = String(formData.get("appSecret") ?? "").trim();
  const verifyToken = String(formData.get("verifyToken") ?? "").trim();
  const instagramAppSecret = String(formData.get("instagramAppSecret") ?? "").trim();
  const clearInstagram = formData.get("clearInstagramAppSecret") === "on";

  if (!appId) {
    return { error: "The Meta app id is required." };
  }

  if (!/^\d{8,}$/.test(appId)) {
    return { error: "A Meta app id is all digits — copy it from App settings → Basic." };
  }

  const existing = await getMetaCredentials(session.member.orgId);
  const effectiveSecret = appSecret || existing.appSecret;

  if (!effectiveSecret) {
    return { error: "The Meta app secret is required the first time you save." };
  }

  if (!verifyToken) {
    return { error: "Pick a verify token. Any string will do, as long as it matches Meta's." };
  }

  // Only spend a round trip when a secret was actually typed. Re-saving the
  // verify token alone should not fail because a previously working secret has
  // since expired.
  if (appSecret) {
    try {
      await verifyAppCredentials(appId, appSecret);
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : "Meta rejected these credentials." };
    }
  }

  try {
    await saveStoredMetaCredentials(session.db, {
      orgId: session.member.orgId,
      updatedBy: session.member.id,
      appId,
      // Undefined leaves the stored secret alone; the form cannot show it back,
      // so an empty field means "unchanged", not "delete".
      appSecret: appSecret || undefined,
      verifyToken,
      instagramAppSecret: clearInstagram ? "" : instagramAppSecret || undefined
    });
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not save the credentials." };
  }

  revalidatePath("/admin/credentials");
  revalidatePath("/admin/channels");
  revalidatePath("/setup");

  return { notice: "Saved. Your workspace now connects Meta accounts through this app." };
}

export async function removeMetaCredentials(
  _state: CredentialsActionState,
  _formData: FormData
): Promise<CredentialsActionState> {
  const session = await requireRole(["admin"]);
  if (session.isDemo) {
    return { error: "Removing credentials needs a configured Supabase project." };
  }

  try {
    await clearStoredMetaCredentials(session.db, session.member.orgId);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not remove the credentials." };
  }

  revalidatePath("/admin/credentials");
  revalidatePath("/admin/channels");
  revalidatePath("/setup");

  // Connected channels keep their own stored tokens and go on sending; only
  // webhook verification and new connections need the app credentials.
  return { notice: "Removed. Connected channels keep working until their tokens expire." };
}
