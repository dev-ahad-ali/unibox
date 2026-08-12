import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { META_STATE_COOKIE, metaAuthorizeUrl, metaConfigured } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";

/** Kicks off the Facebook login dialog. */
export async function GET(request: Request) {
  await requireRole(["admin"], "/admin/channels");

  if (!metaConfigured()) {
    return Response.redirect(new URL("/admin/channels?error=meta_not_configured", request.url));
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

  return Response.redirect(metaAuthorizeUrl(state));
}
