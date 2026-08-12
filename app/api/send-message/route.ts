import { getAdapter } from "@/lib/adapters";
import { canReply, getSession } from "@/lib/auth";
import { isWithinServiceWindow } from "@/lib/service-window";
import { authorizeChannel, findChannel, findConversation, insertMessage } from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";
import { emitConversationEvent, emitOrgEvent } from "@/lib/socket";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!canReply(session.member.role)) {
    return Response.json({ error: "Your role cannot send messages" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string; body?: string }
    | null;

  if (!body?.conversationId || !body.body?.trim()) {
    return Response.json({ error: "conversationId and body are required" }, { status: 400 });
  }

  // Read through the caller's own client so RLS decides what they can see. An
  // agent who is not assigned this conversation gets nothing back here.
  const conversation = await findConversation(session.db, body.conversationId);
  if (!conversation || conversation.orgId !== session.member.orgId) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const channel = await findChannel(session.db, conversation.channelId);
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

  let result: { platformMessageId: string };
  try {
    // Credential columns are revoked from the authenticated role, so decrypting
    // the channel token needs the service client. The caller has already been
    // authorized and the channel confirmed to be in their org.
    const credentialsDb = session.isDemo ? null : createServiceClient();
    const authorized = await authorizeChannel(credentialsDb, channel);
    result = await adapter.sendMessage(authorized, conversation.externalContactId, {
      body: body.body
    });
  } catch (error) {
    // The send failed at the platform, so no message row is written — showing a
    // delivered-looking bubble for a message the customer never got is worse
    // than showing the error.
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to send message." },
      { status: 502 }
    );
  }

  const message = await insertMessage(session.db, {
    conversationId: conversation.id,
    direction: "outbound",
    senderType: "agent",
    // Taken from the session, never from the request body — otherwise a caller
    // could attribute their message to another agent.
    senderId: session.member.id,
    body: body.body,
    platformMessageId: result.platformMessageId,
    status: "sent"
  });

  emitConversationEvent(conversation.id, "new_message", { conversationId: conversation.id, message });
  emitOrgEvent(conversation.orgId, "conversation_updated", { conversationId: conversation.id });

  return Response.json({ ok: true, message });
}
