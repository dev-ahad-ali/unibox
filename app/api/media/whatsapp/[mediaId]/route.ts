import { resolveWhatsAppMedia } from "@/lib/adapters/whatsapp";
import { getSession } from "@/lib/auth";
import { authorizeChannel, findChannelByPlatform } from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";

/**
 * WhatsApp Cloud API media lives behind a short-lived, token-authenticated URL,
 * so it cannot be linked directly from a message bubble. This route resolves
 * the id and streams the bytes through the server on demand.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Not signed in", { status: 401 });
  }

  const { mediaId } = await params;

  // Scoped to the caller's org, so a media id from another workspace cannot be
  // fetched by guessing it.
  const channel = await findChannelByPlatform(session.db, session.member.orgId, "whatsapp");
  if (!channel) {
    return new Response("No WhatsApp channel is connected", { status: 404 });
  }

  try {
    const credentialsDb = session.isDemo ? null : createServiceClient();
    const authorized = await authorizeChannel(credentialsDb, channel);
    const { url, mimeType, accessToken } = await resolveWhatsAppMedia(authorized, mediaId);

    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!upstream.ok || !upstream.body) {
      return new Response("Unable to fetch media", { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? mimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Media lookup failed", {
      status: 502
    });
  }
}
