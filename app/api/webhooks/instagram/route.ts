import { processWebhook } from "@/lib/webhooks";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  if (process.env.META_VERIFY_TOKEN && verifyToken !== process.env.META_VERIFY_TOKEN) {
    return new Response("Invalid verify token", { status: 403 });
  }
  return new Response(challenge ?? "", { status: 200 });
}

export async function POST(request: Request) {
  return processWebhook("instagram", request);
}
