import { handleMetaVerification } from "@/lib/adapters/graph";
import { processWebhook } from "@/lib/webhooks";

export async function GET(request: Request) {
  return handleMetaVerification(
    request,
    process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN
  );
}

export async function POST(request: Request) {
  return processWebhook("whatsapp", request);
}
