import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Liveness and configuration check. Deliberately returns no org or conversation
 * data — this route is reachable without a session so that uptime probes work.
 */
export async function GET() {
  return Response.json({
    ok: true,
    mode: isSupabaseConfigured() ? "supabase" : "demo",
    encryptionKeyConfigured: Boolean(process.env.APP_ENCRYPTION_KEY)
  });
}
