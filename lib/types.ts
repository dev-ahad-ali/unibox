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

/**
 * Credentials are resolved server-side only (decrypted from
 * `channels.access_token_encrypted`) and are never part of the plain `Channel`
 * shape that reaches a page or an agent-facing query.
 */
export interface ChannelCredentials {
  accessToken?: string;
  webhookSecret?: string;
}

export type AuthorizedChannel = Channel & { credentials: ChannelCredentials };

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
  lastInboundAt?: string;
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
  /**
   * The platform account the message arrived on — Page id, WhatsApp phone
   * number id, or LINE destination. Used to route to the right `channels` row
   * when an org has more than one account on the same platform.
   */
  accountId?: string;
  externalContactId: string;
  contactName?: string;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  platformMessageId: string;
  timestamp: Date;
}

/** A delivery/read receipt for a message we sent earlier. */
export interface DeliveryStatusUpdate {
  accountId?: string;
  platformMessageId: string;
  status: MessageStatus;
  timestamp: Date;
}

export interface ParsedWebhook {
  messages: NormalizedMessage[];
  statuses: DeliveryStatusUpdate[];
}

export interface OutboundMessage {
  body: string;
  mediaUrl?: string;
  mediaType?: string;
}

/**
 * Signature verification needs the exact bytes the platform signed, so the raw
 * body travels alongside the request rather than inside it.
 */
export interface WebhookContext {
  request: Request;
  rawBody: string;
}

export interface ChannelAdapter {
  verifyWebhook(context: WebhookContext): Promise<boolean> | boolean;
  parseIncoming(payload: unknown): ParsedWebhook;
  sendMessage(
    channel: AuthorizedChannel,
    externalContactId: string,
    message: OutboundMessage
  ): Promise<{ platformMessageId: string }>;
  fetchContactProfile?(
    channel: AuthorizedChannel,
    externalContactId: string
  ): Promise<{ name: string; avatarUrl?: string }>;
}
