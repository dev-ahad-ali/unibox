import { getAdapter } from "@/lib/adapters";
import { isWithinServiceWindow } from "@/lib/service-window";
import { authorizeChannel, findChannel, findConversation, findUser, insertMessage } from "@/lib/store";
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

  // WhatsApp only allows free-form replies within 24 hours of the customer's
  // last message; outside it Meta rejects anything but an approved template.
  if (channel.platform === "whatsapp" && !isWithinServiceWindow(conversation.lastInboundAt)) {
    return Response.json(
      {
        error:
          "The 24-hour WhatsApp service window has closed for this conversation. Only an approved template message can be sent until the customer replies again.",
        code: "service_window_closed"
      },
      { status: 409 }
    );
  }

  const adapter = getAdapter(channel.platform);
  const sender = body.senderId ? await findUser(body.senderId) : undefined;

  let result: { platformMessageId: string };
  try {
    const authorized = await authorizeChannel(channel);
    result = await adapter.sendMessage(authorized, conversation.externalContactId, { body: body.body });
  } catch (error) {
    // The send failed at the platform, so no message row is written — showing a
    // delivered-looking bubble for a message the customer never got is worse
    // than showing the error.
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to send message." },
      { status: 502 }
    );
  }

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
