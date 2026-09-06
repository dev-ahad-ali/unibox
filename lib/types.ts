export type Platform = "messenger" | "instagram" | "whatsapp" | "line" | "telegram";
export const platforms = ["messenger", "instagram", "whatsapp", "line", "telegram"] as const;

export function isPlatform(value: string | undefined): value is Platform {
  return Boolean(value && platforms.includes(value as Platform));
}
export type Role = "admin" | "agent" | "viewer";
export const roles = ["admin", "agent", "viewer"] as const;

export function isRole(value: string | undefined): value is Role {
  return Boolean(value && roles.includes(value as Role));
}
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
 * The Meta developer app a workspace connects its Pages, Instagram accounts,
 * and WhatsApp numbers through. Stored per organization so one deployment can
 * serve tenants that each bring their own Meta app, rather than one app (and
 * one deployment) per customer.
 */
export interface MetaCredentials {
  /** Public app id from App settings -> Basic. */
  appId?: string;
  /** Signs webhook payloads and the OAuth token exchange. */
  appSecret?: string;
  /** Echoed back during Meta's `hub.challenge` handshake. */
  verifyToken?: string;
  /** Separate secret used by the Instagram-Login product's webhooks. */
  instagramAppSecret?: string;
}

/** What the credentials screen may show: identifiers yes, secrets never. */
export interface MetaCredentialsSummary {
  appId?: string;
  verifyToken?: string;
  hasAppSecret: boolean;
  hasInstagramAppSecret: boolean;
  updatedAt?: string;
  /** True when the values come from deployment env vars rather than this org. */
  fromEnvironment: boolean;
}

/**
 * Signature verification needs the exact bytes the platform signed, so the raw
 * body travels alongside the request rather than inside it.
 */
export interface WebhookContext {
  request: Request;
  rawBody: string;
  /**
   * The matched channel's decrypted webhook secret, when the adapter routes
   * by per-channel secrets (LINE, Telegram).
   */
  secret?: string | null;
  /**
   * App-level signing secrets to accept, for platforms that sign with the
   * developer app's secret rather than a per-channel one (Meta). Resolved from
   * the addressed organization's credentials before verification runs, so one
   * tenant's app secret can never authenticate a payload aimed at another's.
   */
  appSecrets?: readonly string[];
}

export interface ChannelAdapter {
  verifyWebhook(context: WebhookContext): Promise<boolean> | boolean;
  /**
   * Extracts the platform account id this webhook is addressed to, so the
   * signing secret — per channel for LINE and Telegram, per organization for
   * Meta — can be looked up before verification runs.
   */
  webhookAccountId?(payload: unknown, request: Request): string | undefined;
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
  /**
   * Calls the platform with the stored credentials to confirm they still work.
   * Drives the active/error status shown on the channels screen.
   */
  verifyCredentials(channel: AuthorizedChannel): Promise<{ label: string }>;
}
