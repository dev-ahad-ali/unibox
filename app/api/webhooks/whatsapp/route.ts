import { processWebhook } from "@/lib/webhooks";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN ?? process.env.META_VERIFY_TOKEN;

  if (!challenge || !expectedToken || verifyToken !== expectedToken) {
    return new Response("Invalid verify token", { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

export async function POST(request: Request) {
  return processWebhook("whatsapp", request);
}
