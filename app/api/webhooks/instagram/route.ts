import { handleMetaVerification } from "@/lib/adapters/graph";
import { processWebhook } from "@/lib/webhooks";

export async function GET(request: Request) {
  return handleMetaVerification(request, process.env.META_VERIFY_TOKEN);
}

export async function POST(request: Request) {
  return processWebhook("instagram", request);
}
