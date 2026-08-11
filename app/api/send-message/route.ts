import { getAdapter } from "@/lib/adapters";
import { findChannel, findConversation, findUser, insertMessage } from "@/lib/store";
import { emitConversationEvent, emitOrgEvent } from "@/lib/socket";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        conversationId?: string;
        body?: string;
        senderId?: string;
      }
    | null;

  if (!body?.conversationId || !body.body?.trim()) {
    return Response.json({ error: "conversationId and body are required" }, { status: 400 });
  }

  const conversation = await findConversation(body.conversationId);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const channel = await findChannel(conversation.channelId);
  if (!channel) {
    return Response.json({ error: "Channel not found for conversation" }, { status: 404 });
  }

  const adapter = getAdapter(channel.platform);
  const sender = body.senderId ? await findUser(body.senderId) : undefined;
  const result = await adapter.sendMessage(channel, conversation.externalContactId, { body: body.body });

  const message = await insertMessage({
    conversationId: conversation.id,
    direction: "outbound",
    senderType: "agent",
    senderId: sender?.id ?? null,
    body: body.body,
    platformMessageId: result.platformMessageId,
    status: "sent"
  });

  emitConversationEvent(conversation.id, "new_message", { conversationId: conversation.id, message });
  emitOrgEvent(conversation.orgId, "conversation_updated", { conversationId: conversation.id });

  return Response.json({ ok: true, message });
}
