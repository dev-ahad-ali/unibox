"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { newInviteToken } from "@/lib/invites";
import { isRole } from "@/lib/types";

export type AgentActionState = { error?: string; inviteUrl?: string; notice?: string };

export async function createInvite(
  _state: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  // Server actions are public HTTP endpoints — the role check has to happen
  // here, not only in the page that renders the form.
  const session = await requireRole(["admin"]);
  if (session.isDemo) {
    return { error: "Invites need a configured Supabase project." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "agent");

  if (!email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  if (!isRole(role)) {
    return { error: "Pick a valid role." };
  }

  if (!session.db) {
    return { error: "Supabase is not configured." };
  }

  const token = newInviteToken();
  // Written through the caller's client: the "admins can create invites" policy
  // re-checks the role in Postgres even if this action's guard were bypassed.
  const { error } = await session.db.from("org_invites").insert({
    org_id: session.member.orgId,
    email,
    role,
    token,
    invited_by: session.member.id
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/agents");

  // No mail is sent — the admin copies this link. Wiring an email provider is
  // the only step between this and a normal invite email.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { inviteUrl: `${appUrl}/join/${token}`, notice: `Invite created for ${email}.` };
}

export async function revokeInvite(
  _state: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const session = await requireRole(["admin"]);
  const inviteId = String(formData.get("inviteId") ?? "");

  if (!session.db || !inviteId) {
    return { error: "Could not revoke that invite." };
  }

  // Scoped to the caller's org so an admin cannot delete another org's invite
  // by guessing an id.
  const { error } = await session.db
    .from("org_invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", session.member.orgId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/agents");
  return { notice: "Invite revoked." };
}

export async function changeRole(
  _state: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const session = await requireRole(["admin"]);
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!isRole(role)) {
    return { error: "Pick a valid role." };
  }

  if (memberId === session.member.id && role !== "admin") {
    return { error: "You cannot remove your own admin role." };
  }

  if (!session.db) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await session.db
    .from("org_users")
    .update({ role })
    .eq("id", memberId)
    .eq("org_id", session.member.orgId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/agents");
  return { notice: "Role updated." };
}
