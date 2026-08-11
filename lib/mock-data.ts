import { randomUUID } from "node:crypto";
import type {
  Channel,
  Conversation,
  InternalNote,
  Message,
  OrgUser,
  Organization
} from "@/lib/types";

export const demoOrg: Organization = {
  id: "org_demo",
  name: "Unibox Demo Org",
  createdAt: new Date("2026-08-01T08:00:00.000Z").toISOString()
};

export const demoUsers: OrgUser[] = [
  {
    id: "user_admin",
    orgId: demoOrg.id,
    authUserId: "auth_admin",
    role: "admin",
    displayName: "Amina Rahman",
    createdAt: new Date("2026-08-01T08:10:00.000Z").toISOString()
  },
  {
    id: "user_agent",
    orgId: demoOrg.id,
    authUserId: "auth_agent",
    role: "agent",
    displayName: "Nabil Hassan",
    createdAt: new Date("2026-08-01T08:12:00.000Z").toISOString()
  },
  {
    id: "user_viewer",
    orgId: demoOrg.id,
    authUserId: "auth_viewer",
    role: "viewer",
    displayName: "Mina Chowdhury",
    createdAt: new Date("2026-08-01T08:14:00.000Z").toISOString()
  }
];

export const demoChannels: Channel[] = [
  {
    id: "channel_messenger",
    orgId: demoOrg.id,
    platform: "messenger",
    displayName: "Japan Airbnb - Messenger",
    externalAccountId: "page_112233",
    status: "active",
    connectedBy: demoUsers[0].id,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString()
  },
  {
    id: "channel_instagram",
    orgId: demoOrg.id,
    platform: "instagram",
    displayName: "Japan Airbnb - Instagram",
    externalAccountId: "ig_445566",
    status: "active",
    connectedBy: demoUsers[0].id,
    createdAt: new Date("2026-08-01T09:10:00.000Z").toISOString()
  },
  {
    id: "channel_whatsapp",
    orgId: demoOrg.id,
    platform: "whatsapp",
    displayName: "Reservations - WhatsApp",
    externalAccountId: "wa_778899",
    status: "error",
    connectedBy: demoUsers[0].id,
    createdAt: new Date("2026-08-02T11:00:00.000Z").toISOString()
  },
  {
    id: "channel_line",
    orgId: demoOrg.id,
    platform: "line",
    displayName: "Tokyo Support - LINE",
    externalAccountId: "line_556677",
    status: "disconnected",
    connectedBy: demoUsers[0].id,
    createdAt: new Date("2026-08-03T14:00:00.000Z").toISOString()
  }
];

export const demoConversations: Conversation[] = [
  {
    id: "conv_1",
    orgId: demoOrg.id,
    channelId: demoChannels[0].id,
    externalContactId: "contact_1001",
    contactName: "Sarah Kim",
    assignedAgentId: demoUsers[1].id,
    status: "open",
    lastMessageAt: new Date("2026-08-11T08:52:00.000Z").toISOString(),
    createdAt: new Date("2026-08-11T07:33:00.000Z").toISOString()
  },
  {
    id: "conv_2",
    orgId: demoOrg.id,
    channelId: demoChannels[1].id,
    externalContactId: "contact_1002",
    contactName: "Daisuke Tanaka",
    status: "pending",
    lastMessageAt: new Date("2026-08-11T09:18:00.000Z").toISOString(),
    createdAt: new Date("2026-08-10T22:20:00.000Z").toISOString()
  },
  {
    id: "conv_3",
    orgId: demoOrg.id,
    channelId: demoChannels[2].id,
    externalContactId: "contact_1003",
    contactName: "Maya Ibrahim",
    assignedAgentId: demoUsers[1].id,
    status: "closed",
    lastMessageAt: new Date("2026-08-10T15:01:00.000Z").toISOString(),
    createdAt: new Date("2026-08-09T11:05:00.000Z").toISOString()
  }
];

export const demoMessages: Message[] = [
  {
    id: "msg_1",
    conversationId: "conv_1",
    direction: "inbound",
    senderType: "customer",
    body: "Hi, I booked for Friday but I need a late check-in. Is that possible?",
    status: "read",
    createdAt: new Date("2026-08-11T08:45:00.000Z").toISOString()
  },
  {
    id: "msg_2",
    conversationId: "conv_1",
    direction: "outbound",
    senderType: "agent",
    senderId: demoUsers[1].id,
    body: "Yes, we can arrange that. I’ll confirm the key pickup process shortly.",
    platformMessageId: "plat_2001",
    status: "sent",
    createdAt: new Date("2026-08-11T08:52:00.000Z").toISOString()
  },
  {
    id: "msg_3",
    conversationId: "conv_2",
    direction: "inbound",
    senderType: "customer",
    body: "Do you have a quiet room near the elevator?",
    status: "delivered",
    createdAt: new Date("2026-08-11T09:18:00.000Z").toISOString()
  },
  {
    id: "msg_4",
    conversationId: "conv_3",
    direction: "inbound",
    senderType: "customer",
    body: "Thanks, the refund arrived. Closing the case.",
    status: "read",
    createdAt: new Date("2026-08-10T15:01:00.000Z").toISOString()
  }
];

export const demoNotes: InternalNote[] = [
  {
    id: randomUUID(),
    conversationId: "conv_1",
    authorId: demoUsers[0].id,
    body: "Offer a 15-minute buffer for late check-in and keep the customer updated in-thread.",
    createdAt: new Date("2026-08-11T08:40:00.000Z").toISOString()
  },
  {
    id: randomUUID(),
    conversationId: "conv_2",
    authorId: demoUsers[1].id,
    body: "Customer prefers lower-floor rooms and usually replies within 10 minutes.",
    createdAt: new Date("2026-08-11T09:20:00.000Z").toISOString()
  }
];
