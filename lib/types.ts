export type Platform = "messenger" | "instagram" | "whatsapp" | "line";
export const platforms = ["messenger", "instagram", "whatsapp", "line"] as const;

export function isPlatform(value: string | undefined): value is Platform {
  return Boolean(value && platforms.includes(value as Platform));
}
export type Role = "admin" | "agent" | "viewer";
export type ConversationStatus = "open" | "pending" | "closed";
export type ChannelStatus = "active" | "disconnected" | "error";
export type MessageDirection = "inbound" | "outbound";
export type SenderType = "customer" | "agent" | "system";
export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  orgId: string;
  authUserId: string;
  role: Role;
  displayName: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  orgId: string;
  platform: Platform;
  displayName: string;
  externalAccountId: string;
  status: ChannelStatus;
  connectedBy?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  orgId: string;
  channelId: string;
  externalContactId: string;
  contactName: string;
  contactAvatarUrl?: string;
  assignedAgentId?: string | null;
  status: ConversationStatus;
  lastMessageAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string | null;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  platformMessageId?: string;
  status: MessageStatus;
  createdAt: string;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface NormalizedMessage {
  externalContactId: string;
  contactName?: string;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  platformMessageId: string;
  timestamp: Date;
}

export interface OutboundMessage {
  body: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface ChannelAdapter {
  verifyWebhook(request: Request): Promise<boolean> | boolean;
  parseIncoming(payload: unknown): NormalizedMessage[];
  sendMessage(
    channel: Channel,
    externalContactId: string,
    message: OutboundMessage
  ): Promise<{ platformMessageId: string }>;
  fetchContactProfile?(
    channel: Channel,
    externalContactId: string
  ): Promise<{ name: string; avatarUrl?: string }>;
}
