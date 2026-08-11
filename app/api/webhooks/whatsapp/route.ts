import { processWebhook } from "@/lib/webhooks";

export async function POST(request: Request) {
  return processWebhook("whatsapp", request);
}
