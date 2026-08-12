import { randomBytes } from "node:crypto";
import { createServiceClient, type Db } from "@/lib/supabase";
import type { Role } from "@/lib/types";

export type Invite = {
  id: string;
  orgId: string;
  organizationName: string;
  email: string;
  role: Role;
  token: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

type InviteRow = {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string | null;
  organizations?: { name?: string } | null;
};

const INVITE_COLUMNS = "id, org_id, email, role, token, accepted_at, expires_at, created_at";

function toInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    orgId: row.org_id,
    organizationName: row.organizations?.name ?? "",
    email: row.email,
    role: row.role,
    token: row.token,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function isInviteUsable(invite: Pick<Invite, "acceptedAt" | "expiresAt">) {
  return !invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now();
}

/** Runs on the caller's client — the RLS policy limits this to org admins. */
export async function listInvites(db: Db, orgId: string): Promise<Invite[]> {
  if (!db) {
    return [];
  }

  const { data } = await db
    .from("org_invites")
    .select(INVITE_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(toInvite);
}

/**
 * Invites are looked up by an unguessable token before the caller is a member
 * of anything, so this path necessarily runs on the service client. The token
 * is the only credential — never expose the invite list to non-admins.
 */
export async function findInviteByToken(token: string): Promise<Invite | null> {
  const service = createServiceClient();
  if (!service || !token) {
    return null;
  }

  const { data } = await service
    .from("org_invites")
    .select(`${INVITE_COLUMNS}, organizations(name)`)
    .eq("token", token)
    .maybeSingle<InviteRow>();

  return data ? toInvite(data) : null;
}
