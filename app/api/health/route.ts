import { isDemoMode } from "@/lib/env";
import { getDemoSnapshot, summarizeInbox } from "@/lib/store";

export async function GET() {
  const snapshot = await getDemoSnapshot();
  return Response.json({
    ok: true,
    mode: isDemoMode() ? "demo" : "supabase",
    org: snapshot.organization.name,
    summary: await summarizeInbox()
  });
}
