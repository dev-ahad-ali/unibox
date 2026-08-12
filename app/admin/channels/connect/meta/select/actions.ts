"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  META_TOKEN_COOKIE,
  discoverMetaAssets,
  subscribePageWebhook
} from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { upsertChannel } from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";

export type SelectFormState = { error?: string; notice?: string };

/** Reads the parked user token from its encrypted cookie. */
export async function readConnectedUserToken() {
  const cookieStore = await cookies();
  return decryptSecret(cookieStore.get(META_TOKEN_COOKIE)?.value);
}

export async function connectSelectedAssets(
  _state: SelectFormState,
  formData: FormData
): Promise<SelectFormState> {
  const session = await requireRole(["admin"], "/admin/channels");

  const userToken = await readConnectedUserToken();
  if (!userToken) {
    return { error: "The Meta connection expired. Start again from the channels page." };
  }

  const selected = new Set(formData.getAll("asset").map(String));
  if (selected.size === 0) {
    return { error: "Pick at least one account to connect." };
  }

  const service = createServiceClient();
  if (!service) {
    return { error: "Supabase service credentials are not configured." };
  }

  // Re-fetch rather than trusting ids and tokens posted from the form — a
  // client could otherwise submit an account it was never authorized for.
  const { assets } = await discoverMetaAssets(userToken);

  const connected: string[] = [];
  const failures: string[] = [];

  for (const asset of assets) {
    if (!selected.has(`${asset.platform}:${asset.externalAccountId}`)) {
      continue;
    }

    try {
      await upsertChannel(service, {
        orgId: session.member.orgId,
        platform: asset.platform,
        displayName: asset.displayName,
        externalAccountId: asset.externalAccountId,
        accessToken: asset.accessToken,
        connectedBy: session.member.id,
        status: "active"
      });

      // Without this the channel exists but Meta never delivers anything.
      const pageId = asset.platform === "messenger" ? asset.externalAccountId : asset.parentPageId;
      if (pageId) {
        await subscribePageWebhook(pageId, asset.accessToken);
      }

      connected.push(asset.displayName);
    } catch (error) {
      failures.push(
        `${asset.displayName}: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }

  if (connected.length === 0) {
    return { error: failures.join(" · ") || "Nothing was connected." };
  }

  const cookieStore = await cookies();
  cookieStore.delete(META_TOKEN_COOKIE);

  revalidatePath("/admin/channels");
  redirect(
    `/admin/channels?connected=${encodeURIComponent(connected.join(", "))}${
      failures.length ? `&error=${encodeURIComponent(failures.join(" · "))}` : ""
    }`
  );
}

export async function cancelMetaConnect() {
  await requireRole(["admin"], "/admin/channels");
  const cookieStore = await cookies();
  cookieStore.delete(META_TOKEN_COOKIE);
  redirect("/admin/channels");
}
