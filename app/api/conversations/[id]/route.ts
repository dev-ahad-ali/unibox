import { requireApiSession } from "@/lib/auth";
import { getConversationBundle } from "@/lib/store";

/** Thread bundle for the client-side inbox: conversation, channel, messages, notes. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await context.params;
  const bundle = await getConversationBundle(session.db, session.member.orgId, id);

  // RLS hides conversations the caller cannot see, so "not visible to you" and
  // "does not exist" are deliberately the same answer.
  if (!bundle) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({
    conversation: bundle.conversation,
    channel: bundle.channel,
    messages: bundle.messages,
    notes: bundle.notes,
    users: bundle.users
  });
}
