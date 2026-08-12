import { cookies } from "next/headers";
import { appUrl } from "@/lib/app-url";
import {
  META_STATE_COOKIE,
  META_TOKEN_COOKIE,
  exchangeCodeForUserToken
} from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { encryptSecret, isEncryptionConfigured, safeEqual } from "@/lib/crypto";
/**
 * Handles Meta's redirect back. Exchanges the code for a long-lived user token
 * and parks it in an encrypted, httpOnly cookie so the picker screen can list
 * assets without the token ever reaching the browser in readable form.
 */
export async function GET(request: Request) {
  await requireRole(["admin"], "/admin/channels");

  const url = new URL(request.url);
  const cookieStore = await cookies();

  const fail = (reason: string) =>
    Response.redirect(appUrl(`/admin/channels?error=${encodeURIComponent(reason)}`));

  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    return fail(error);
  }

  const state = url.searchParams.get("state");
  const expectedState = cookieStore.get(META_STATE_COOKIE)?.value;
  cookieStore.delete(META_STATE_COOKIE);

  if (!state || !expectedState || !safeEqual(expectedState, state)) {
    return fail("The connection request expired or did not match. Try again.");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return fail("Meta did not return an authorization code.");
  }

  if (!isEncryptionConfigured()) {
    return fail("Set APP_ENCRYPTION_KEY before connecting a Meta account.");
  }

  let userToken: string;
  try {
    userToken = await exchangeCodeForUserToken(code);
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Token exchange failed.");
  }

  cookieStore.set(META_TOKEN_COOKIE, encryptSecret(userToken), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/channels",
    maxAge: 900
  });

  return Response.redirect(appUrl("/admin/channels/connect/meta/select"));
}
