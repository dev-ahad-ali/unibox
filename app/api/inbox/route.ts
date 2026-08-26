import { requireApiSession } from "@/lib/auth";
import { getInboxLists, summarizeInbox } from "@/lib/store";

/**
 * List refresh for the client-side inbox: conversations, channels, users, and
 * the header summary in one response. Reads through the caller's own client so
 * RLS decides what they see.
 */
export async function GET() {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { db, member } = session;
  const [snapshot, summary] = await Promise.all([
    getInboxLists(db, member.orgId),
    summarizeInbox(db, member.orgId)
  ]);

  return Response.json({
    conversations: snapshot.conversations,
    channels: snapshot.channels,
    users: snapshot.users,
    summary
  });
}
