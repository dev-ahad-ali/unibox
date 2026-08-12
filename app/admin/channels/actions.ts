"use server";

import { revalidatePath } from "next/cache";
import { getAdapter } from "@/lib/adapters";
import { subscribePageWebhook } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { isEncryptionConfigured } from "@/lib/crypto";
import {
  authorizeChannel,
  deleteChannel,
  findChannel,
  updateChannelSettings,
  upsertChannel
} from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";
import { isPlatform, type Platform } from "@/lib/types";

export type ChannelActionState = { error?: string; notice?: string };

/** Human-readable name of the id each platform expects in external_account_id. */
const ACCOUNT_ID_LABEL: Record<Platform, string> = {
  messenger: "Facebook Page id",
  instagram: "Instagram account id",
  whatsapp: "WhatsApp phone number id",
  line: "LINE bot user id"
};

export async function connectChannel(
  _state: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const session = await requireRole(["admin"]);
  if (session.isDemo) {
    return { error: "Connecting a channel needs a configured Supabase project." };
  }

  if (!isEncryptionConfigured()) {
    return { error: "Set APP_ENCRYPTION_KEY before storing platform credentials." };
  }

  const platform = String(formData.get("platform") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const externalAccountId = String(formData.get("externalAccountId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!isPlatform(platform)) {
    return { error: "Pick a platform." };
  }

  if (!externalAccountId) {
    return { error: `The ${ACCOUNT_ID_LABEL[platform]} is required.` };
  }

  if (!accessToken) {
    return { error: "An access token is required." };
  }

  const service = createServiceClient();
  if (!service) {
    return { error: "Supabase service credentials are not configured." };
  }

  // Verify before storing. Saving a credential that does not work would leave a
  // channel that looks connected and silently drops every reply.
  const adapter = getAdapter(platform);
  let label: string;
  try {
    const probe = await adapter.verifyCredentials({
      id: "probe",
      orgId: session.member.orgId,
      platform,
      displayName: displayName || externalAccountId,
      externalAccountId,
      status: "active",
      createdAt: new Date().toISOString(),
      credentials: { accessToken }
    });
    label = probe.label;
  } catch (error) {
    return {
      error: `The platform rejected these credentials: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    };
  }

  try {
    await upsertChannel(service, {
      orgId: session.member.orgId,
      platform,
      displayName: displayName || label,
      externalAccountId,
      accessToken,
      connectedBy: session.member.id,
      status: "active"
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the channel." };
  }

  // Messenger and Instagram need an explicit webhook subscription on the Page.
  let notice = `Connected ${label}.`;
  if (platform === "messenger") {
    try {
      await subscribePageWebhook(externalAccountId, accessToken);
      notice += " Webhook subscribed.";
    } catch (error) {
      notice += ` Saved, but subscribing the webhook failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
    }
  }

  revalidatePath("/admin/channels");
  return { notice };
}

export async function testChannel(
  _state: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const session = await requireRole(["admin"]);
  const channelId = String(formData.get("channelId") ?? "");

  const channel = await findChannel(session.db, channelId);
  if (!channel || channel.orgId !== session.member.orgId) {
    return { error: "Channel not found." };
  }

  if (session.isDemo) {
    return { error: "Testing a channel needs a configured Supabase project." };
  }

  const service = createServiceClient();
  const authorized = await authorizeChannel(service, channel);

  try {
    const { label } = await getAdapter(channel.platform).verifyCredentials(authorized);
    await updateChannelSettings(session.db, channelId, session.member.orgId, { status: "active" });
    revalidatePath("/admin/channels");
    return { notice: `${label} responded — credentials are valid.` };
  } catch (error) {
    // Record the failure so the list reflects reality instead of a stale
    // "active" from whenever the channel was first connected.
    await updateChannelSettings(session.db, channelId, session.member.orgId, { status: "error" });
    revalidatePath("/admin/channels");
    return { error: error instanceof Error ? error.message : "The platform rejected the token." };
  }
}

export async function renameChannel(
  _state: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const session = await requireRole(["admin"]);
  const channelId = String(formData.get("channelId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { error: "Name cannot be empty." };
  }

  await updateChannelSettings(session.db, channelId, session.member.orgId, { displayName });
  revalidatePath("/admin/channels");
  return { notice: "Channel renamed." };
}

export async function disconnectChannel(
  _state: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const session = await requireRole(["admin"]);
  const channelId = String(formData.get("channelId") ?? "");
  const mode = String(formData.get("mode") ?? "disable");

  if (mode === "delete") {
    // conversations and messages cascade from channels, so this is destructive.
    // The UI asks for confirmation before sending mode=delete.
    await deleteChannel(session.db, channelId, session.member.orgId);
    revalidatePath("/admin/channels");
    return { notice: "Channel and its conversations were deleted." };
  }

  await updateChannelSettings(session.db, channelId, session.member.orgId, {
    status: "disconnected"
  });
  revalidatePath("/admin/channels");
  return { notice: "Channel disconnected. Its history is kept." };
}
