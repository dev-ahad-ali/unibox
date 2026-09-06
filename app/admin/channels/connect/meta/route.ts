import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { appUrl } from "@/lib/app-url";
import { META_STATE_COOKIE, metaAuthorizeUrl } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { getMetaCredentials } from "@/lib/meta-app";

/** Kicks off the Facebook login dialog. */
export async function GET() {
  const session = await requireRole(["admin"], "/admin/channels");

  // The app belongs to the workspace, not the deployment, so the dialog is
  // opened against whichever Meta app this org saved.
  const { appId, appSecret } = await getMetaCredentials(session.member.orgId);
  if (!appId || !appSecret) {
    return Response.redirect(
      appUrl(
        "/admin/credentials?error=" +
          encodeURIComponent("Add your Meta app id and secret before connecting an account.")
      )
    );
  }

  // CSRF: Meta echoes `state` back to the callback, and we only accept a value
  // that matches the cookie we just set.
  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(META_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/channels",
    maxAge: 600
  });

  return Response.redirect(metaAuthorizeUrl(state, appId));
}
