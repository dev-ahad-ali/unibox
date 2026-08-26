import { processWebhook } from "@/lib/webhooks";

// Telegram has no verification handshake — setWebhook just starts delivering.
// Authenticity comes from the secret_token echoed in the request headers.
export async function POST(request: Request) {
  return processWebhook("telegram", request);
}
