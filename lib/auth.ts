import { redirect } from "next/navigation";
import { demoOrg, demoUsers } from "@/lib/mock-data";
import { findMembership, findOrganization } from "@/lib/store";
import { createUserClient, isSupabaseConfigured, type Db } from "@/lib/supabase";
import type { Organization, OrgUser, Role } from "@/lib/types";

export type Session = {
  db: Db;
  authUserId: string;
  email: string;
  member: OrgUser;
  organization: Organization;
  /** True when Supabase is unconfigured and the app is showing seeded data. */
  isDemo: boolean;
};

/**
 * With no Supabase project configured there is no identity provider, so the app
 * runs as the seeded demo admin against in-memory data. This exists so the UI
 * is explorable locally; it is never reachable once Supabase env vars are set.
 */
function demoSession(): Session {
  return {
    db: null,
    authUserId: demoUsers[0].authUserId,
    email: "demo@unibox.local",
    member: demoUsers[0],
    organization: demoOrg,
    isDemo: true
  };
}

/**
 * Resolves the signed-in user and their org membership. Returns null when the
 * caller is not signed in, or is signed in but not yet a member of any org.
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return demoSession();
  }

  const db = await createUserClient();
  if (!db) {
    return null;
  }

  // getUser() revalidates the JWT against Supabase. getSession() would just
  // decode the cookie, which a client can forge.
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    return null;
  }

  const member = await findMembership(db, user.id);
  if (!member) {
    return null;
  }

  const organization = await findOrganization(db, member.orgId);
  if (!organization) {
    return null;
  }

  return {
    db,
    authUserId: user.id,
    email: user.email ?? "",
    member,
    organization,
    isDemo: false
  };
}

/** Signed-in users only. Sends everyone else to the login page. */
export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession();
  if (session) {
    return session;
  }

  redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
}

/**
 * Role gate for pages. This is a second line of defense: the RLS policies in
 * Postgres already restrict what each role can read, and the middleware already
 * blocks anonymous requests.
 */
export async function requireRole(roles: readonly Role[], returnTo?: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (!roles.includes(session.member.role)) {
    redirect("/inbox?denied=1");
  }
  return session;
}

export function canReply(role: Role) {
  return role === "admin" || role === "agent";
}

export function isAdmin(role: Role) {
  return role === "admin";
}
