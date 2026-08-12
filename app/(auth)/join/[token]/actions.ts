"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findInviteByToken, isInviteUsable } from "@/lib/invites";
import { createServiceClient, createUserClient } from "@/lib/supabase";

export type JoinFormState = { error?: string; notice?: string };

/**
 * Links an authenticated user to the invite's org. The invite token is the
 * credential; it is validated server-side on every call, and consumed so it
 * cannot be replayed.
 */
async function acceptInviteFor(authUserId: string, token: string, displayName: string) {
  const service = createServiceClient();
  if (!service) {
    return { error: "Supabase service credentials are not configured." };
  }

  const invite = await findInviteByToken(token);
  if (!invite) {
    return { error: "This invite link is not valid." };
  }

  if (!isInviteUsable(invite)) {
    return { error: "This invite has already been used or has expired." };
  }

  const { data: existing } = await service
    .from("org_users")
    .select("id, org_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle<{ id: string; org_id: string }>();

  if (existing && existing.org_id !== invite.orgId) {
    return { error: "This account already belongs to another workspace." };
  }

  if (!existing) {
    const { error } = await service.from("org_users").insert({
      org_id: invite.orgId,
      auth_user_id: authUserId,
      role: invite.role,
      display_name: displayName || invite.email.split("@")[0]
    });

    if (error) {
      return { error: error.message };
    }
  }

  // Mark accepted only after membership exists, and only if still unaccepted,
  // so two concurrent clicks cannot both create a membership.
  await service
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null);

  return { ok: true as const };
}

export async function acceptInvite(
  _state: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
  const token = String(formData.get("token") ?? "");

  const db = await createUserClient();
  if (!db) {
    return { error: "Supabase is not configured on this server." };
  }

  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    return { error: "Sign in first, then open the invite link again." };
  }

  const result = await acceptInviteFor(user.id, token, user.user_metadata?.name ?? "");
  if ("error" in result) {
    return result;
  }

  revalidatePath("/", "layout");
  redirect("/inbox");
}

export async function signUpWithInvite(
  _state: JoinFormState,
  formData: FormData
): Promise<JoinFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const invite = await findInviteByToken(token);
  if (!invite || !isInviteUsable(invite)) {
    return { error: "This invite link is not valid or has expired." };
  }

  const db = await createUserClient();
  if (!db) {
    return { error: "Supabase is not configured on this server." };
  }

  // The email comes from the invite row, never from the form — otherwise an
  // invite for one address could be used to register another.
  const { data, error } = await db.auth.signUp({ email: invite.email, password });
  if (error) {
    return { error: error.message };
  }

  const authUserId = data.user?.id;
  if (!authUserId) {
    return { error: "Sign-up did not return a user." };
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "That email already has an account. Sign in, then reopen this link." };
  }

  const result = await acceptInviteFor(authUserId, token, displayName);
  if ("error" in result) {
    return result;
  }

  if (!data.session) {
    return {
      notice: `You have joined ${invite.organizationName || "the workspace"}. Check ${invite.email} for a confirmation link, then sign in.`
    };
  }

  revalidatePath("/", "layout");
  redirect("/inbox");
}
