import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { DATA_DELETION_PATH, deletionStatusUrl } from "@/lib/legal";
import { envMetaCredentials, orgIdFromRequest } from "@/lib/meta-app";
import { parseSignedRequest } from "@/lib/signed-request";
import {
  deleteContactData,
  getStoredMetaCredentials,
  listStoredMetaAppSecrets,
  recordDeletionRequest
} from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";
import { appUrl } from "@/lib/app-url";

/**
 * Meta's Data Deletion Request Callback.
 *
 * Registered in the App Dashboard under App settings -> Basic. Meta POSTs a
 * `signed_request` when someone removes this app from their Facebook account,
 * and expects JSON naming a confirmation code and a URL where the person can
 * check on the request. Both are required for App Review to pass.
 *
 * Authenticated by the signature alone. There is no session here, which is why
 * the route is excluded from the middleware matcher alongside the webhooks.
 */

type ResolvedRequest = { userId: string; orgId?: string };

/** The org whose app secret signed this request, and the payload it carried. */
async function resolveSignedRequest(
  request: Request,
  signedRequest: string
): Promise<ResolvedRequest | null> {
  const db = createServiceClient();
  const scopedOrgId = orgIdFromRequest(request);

  // A `?org=` callback URL names the workspace outright, the same way the
  // webhook URLs do, so only that org's secret is a candidate.
  if (scopedOrgId) {
    const credentials = await getStoredMetaCredentials(db, scopedOrgId);
    for (const secret of [credentials?.appSecret, credentials?.instagramAppSecret]) {
      const payload = secret ? parseSignedRequest(signedRequest, secret) : null;
      if (payload?.user_id) {
        return { userId: payload.user_id, orgId: scopedOrgId };
      }
    }
  }

  // Otherwise the signature itself identifies the org: whichever stored secret
  // verifies it is the app the request came from.
  for (const { orgId, secrets } of await listStoredMetaAppSecrets(db)) {
    for (const secret of secrets) {
      const payload = parseSignedRequest(signedRequest, secret);
      if (payload?.user_id) {
        return { userId: payload.user_id, orgId };
      }
    }
  }

  // The deployment's own app, which belongs to no single org.
  const env = envMetaCredentials();
  for (const secret of [env.appSecret, env.instagramAppSecret]) {
    const payload = secret ? parseSignedRequest(signedRequest, secret) : null;
    if (payload?.user_id) {
      return { userId: payload.user_id };
    }
  }

  return null;
}

async function readSignedRequest(request: Request): Promise<string | undefined> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { signed_request?: unknown } | null;
    return typeof body?.signed_request === "string" ? body.signed_request : undefined;
  }

  const form = await request.formData().catch(() => null);
  const value = form?.get("signed_request");
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  const signedRequest = await readSignedRequest(request);
  if (!signedRequest) {
    return NextResponse.json({ error: "Missing signed_request." }, { status: 400 });
  }

  const resolved = await resolveSignedRequest(request, signedRequest);
  if (!resolved) {
    // No configured app secret produced this signature, so the request is not
    // from an app this deployment serves.
    return NextResponse.json({ error: "Invalid signed_request." }, { status: 401 });
  }

  const db = createServiceClient();
  const conversationsDeleted = await deleteContactData(db, {
    externalUserId: resolved.userId,
    orgId: resolved.orgId
  });

  const code = randomBytes(16).toString("hex");

  // The deletion above has already happened, and Meta retries any non-200. A
  // failure to write the audit row must not turn a completed deletion into a
  // redelivery loop, so it is logged and the confirmation still goes back. The
  // status page reports an unknown code rather than claiming nothing happened.
  try {
    await recordDeletionRequest(db, {
      code,
      orgId: resolved.orgId,
      externalUserId: resolved.userId,
      conversationsDeleted,
      status: conversationsDeleted > 0 ? "completed" : "no_data"
    });
  } catch (error) {
    console.error(
      `[unibox] Deleted ${conversationsDeleted} conversation(s) but could not record request ${code}:`,
      error instanceof Error ? error.message : error
    );
  }

  return NextResponse.json({ url: deletionStatusUrl(code), confirmation_code: code });
}

/** Meta only ever POSTs here; a browser that finds the URL gets the readable page. */
export async function GET() {
  return NextResponse.redirect(appUrl(DATA_DELETION_PATH), 302);
}

export const dynamic = "force-dynamic";
