import { after } from "next/server";

/**
 * Live updates ride Supabase Realtime Broadcast instead of a Socket.io server,
 * so the app can run on serverless hosts (Vercel) with no process that holds
 * connections open.
 *
 * Each org has one private topic, `org:<orgId>`. Browsers subscribe with their
 * own session, and the policy on `realtime.messages` (supabase/rls.sql) only
 * lets a user join the topic of the org they belong to — the org is never taken
 * from anything the client claims.
 */

export type OrgEvent = {
  orgId: string;
  event: "new_message" | "conversation_updated" | "message_status" | "webhook_received";
  payload: Record<string, unknown>;
};

export function orgTopic(orgId: string) {
  return `org:${orgId}`;
}

/**
 * Sends events through Realtime's REST endpoint. Plain HTTP, so it works from
 * a serverless function that has no socket to keep open. Never throws — a
 * missed live update must not fail the webhook or send that caused it.
 */
export async function broadcastToOrgs(events: OrgEvent[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey || events.length === 0) {
    return;
  }

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: events.map(entry => ({
          topic: orgTopic(entry.orgId),
          event: entry.event,
          payload: entry.payload,
          private: true
        }))
      })
    });
    if (!response.ok) {
      console.error(`[realtime] broadcast failed: ${response.status} ${await response.text()}`);
    }
  } catch (error) {
    console.error("[realtime] broadcast failed:", error);
  }
}

export function broadcastToOrg(orgId: string, event: OrgEvent["event"], payload: Record<string, unknown>) {
  return broadcastToOrgs([{ orgId, event, payload }]);
}

/**
 * Runs work after the response is sent. On serverless hosts a bare
 * fire-and-forget promise is frozen along with the function the moment the
 * response goes out; `after()` keeps the invocation alive until it settles.
 * Outside a request (unit tests) `after()` throws, so the task just runs
 * detached as before.
 */
export function runAfterResponse(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}
