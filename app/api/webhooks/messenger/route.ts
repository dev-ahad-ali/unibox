import { handleMetaVerification } from "@/lib/adapters/graph";
import { resolveMetaVerifyTokens } from "@/lib/meta-app";
import { processWebhook } from "@/lib/webhooks";

// The verify token is per organization now, so the acceptable values depend on
// the request: a `?org=` callback URL narrows it to one workspace, an unscoped
// one has to accept any tenant's.
export async function GET(request: Request) {
  return handleMetaVerification(request, await resolveMetaVerifyTokens(request));
}

export async function POST(request: Request) {
  return processWebhook("messenger", request);
}
