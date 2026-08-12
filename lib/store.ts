import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { demoChannels, demoConversations, demoMessages, demoNotes, demoOrg, demoUsers } from "@/lib/mock-data";
import type { Db } from "@/lib/supabase";
import type {
  AuthorizedChannel,
  Channel,
  Conversation,
  ConversationStatus,
  InternalNote,
  Message,
  MessageStatus,
  OrgUser,
  Organization,
  Platform
} from "@/lib/types";

/**
 * Every function here takes the Supabase client explicitly. Pages and actions
 * pass a user-scoped client so RLS applies; webhooks pass the service client
 * because there is no signed-in user behind an inbound message. A `null` client
 * means Supabase is not configured and the seeded demo state is used instead.
 */

type OrganizationRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type OrgUserRow = {
  id: string;
  org_id: string;
  auth_user_id: string;
  role: OrgUser["role"];
  display_name: string | null;
  created_at: string | null;
};

type ChannelRow = {
  id: string;
  org_id: string;
  platform: Platform;
  display_name: string | null;
  external_account_id: string;
  status: Channel["status"];
  connected_by: string | null;
  created_at: string | null;
};

type ConversationRow = {
  id: string;
  org_id: string;
  channel_id: string;
  external_contact_id: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  assigned_agent_id: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_inbound_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  direction: Message["direction"];
  sender_type: Message["senderType"];
  sender_id: string | null;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  platform_message_id: string | null;
  status: MessageStatus;
  created_at: string | null;
};

type InternalNoteRow = {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string | null;
};

export type StoreSnapshot = {
  organization: Organization;
  users: OrgUser[];
  channels: Channel[];
  conversations: Conversation[];
  messages: Message[];
  notes: InternalNote[];
};

type NewConversationInput = {
  channelId: string;
  externalContactId: string;
  contactName?: string;
  contactAvatarUrl?: string;
};

type NewMessageInput = {
  conversationId: string;
  direction: "inbound" | "outbound";
  senderType: "customer" | "agent" | "system";
  senderId?: string | null;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  platformMessageId?: string;
  status?: MessageStatus;
};

// Column lists are named so that credential columns (access_token_encrypted,
// webhook_secret) can never leak into a query that feeds the UI.
const ORGANIZATION_COLUMNS = "id, name, created_at";
const ORG_USER_COLUMNS = "id, org_id, auth_user_id, role, display_name, created_at";
const CHANNEL_COLUMNS =
  "id, org_id, platform, display_name, external_account_id, status, connected_by, created_at";
const CONVERSATION_COLUMNS =
  "id, org_id, channel_id, external_contact_id, contact_name, contact_avatar_url, assigned_agent_id, status, last_message_at, last_inbound_at, created_at";
const MESSAGE_COLUMNS =
  "id, conversation_id, direction, sender_type, sender_id, body, media_url, media_type, platform_message_id, status, created_at";
const NOTE_COLUMNS = "id, conversation_id, author_id, body, created_at";

declare global {
  // eslint-disable-next-line no-var
  var __unibox_store: {
    organizations: Organization[];
    users: OrgUser[];
    channels: Channel[];
    conversations: Conversation[];
    messages: Message[];
    notes: InternalNote[];
  } | undefined;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A failed query used to fall back to demo data silently, which made a missing
 * column look like an empty inbox. Log it instead so the cause is visible.
 */
function reportQueryError(table: string, error: { message?: string } | null) {
  if (!error) {
    return false;
  }

  console.error(`[unibox] Supabase query on "${table}" failed: ${error.message ?? "unknown error"}`);
  return true;
}

function createInitialState() {
  return {
    organizations: [demoOrg],
    users: [...demoUsers],
    channels: [...demoChannels],
    conversations: [...demoConversations],
    messages: [...demoMessages],
    notes: [...demoNotes]
  };
}

function getDemoState() {
  globalThis.__unibox_store ??= createInitialState();
  return globalThis.__unibox_store;
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function toOrgUser(row: OrgUserRow): OrgUser {
  return {
    id: row.id,
    orgId: row.org_id,
    authUserId: row.auth_user_id,
    role: row.role,
    displayName: row.display_name ?? row.auth_user_id,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    orgId: row.org_id,
    platform: row.platform,
    displayName: row.display_name ?? row.platform,
    externalAccountId: row.external_account_id,
    status: row.status,
    connectedBy: row.connected_by,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    orgId: row.org_id,
    channelId: row.channel_id,
    externalContactId: row.external_contact_id,
    contactName: row.contact_name ?? row.external_contact_id,
    contactAvatarUrl: row.contact_avatar_url ?? undefined,
    assignedAgentId: row.assigned_agent_id,
    status: row.status,
    lastMessageAt: row.last_message_at ?? undefined,
    lastInboundAt: row.last_inbound_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    senderType: row.sender_type,
    senderId: row.sender_id,
    body: row.body ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    platformMessageId: row.platform_message_id ?? undefined,
    status: row.status,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function toNote(row: InternalNoteRow): InternalNote {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Organizations and membership
// ---------------------------------------------------------------------------

export async function findOrganization(db: Db, orgId: string): Promise<Organization | undefined> {
  if (!db) {
    return getDemoState().organizations.find(entry => entry.id === orgId) ?? demoOrg;
  }

  const { data } = await db
    .from("organizations")
    .select(ORGANIZATION_COLUMNS)
    .eq("id", orgId)
    .maybeSingle<OrganizationRow>();

  return data ? toOrganization(data) : undefined;
}

/** Resolves the caller's membership row from their Supabase Auth user id. */
export async function findMembership(db: Db, authUserId: string): Promise<OrgUser | undefined> {
  if (!db) {
    return getDemoState().users.find(user => user.authUserId === authUserId) ?? demoUsers[0];
  }

  const { data, error } = await db
    .from("org_users")
    .select(ORG_USER_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle<OrgUserRow>();

  if (reportQueryError("org_users", error) || !data) {
    return undefined;
  }

  return toOrgUser(data);
}

export async function listOrgUsers(db: Db, orgId: string): Promise<OrgUser[]> {
  if (!db) {
    return clone(getDemoState().users);
  }

  const { data, error } = await db
    .from("org_users")
    .select(ORG_USER_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (reportQueryError("org_users", error)) {
    return [];
  }

  return (data ?? []).map(toOrgUser);
}

export async function findUser(db: Db, userId: string): Promise<OrgUser | undefined> {
  if (!db) {
    return getDemoState().users.find(user => user.id === userId);
  }

  const { data, error } = await db
    .from("org_users")
    .select(ORG_USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<OrgUserRow>();

  if (error || !data) {
    return undefined;
  }

  return toOrgUser(data);
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

async function getOrgSnapshotFromSupabase(
  db: NonNullable<Db>,
  orgId: string,
  platformFilter?: Platform
): Promise<StoreSnapshot | null> {
  const organization = await findOrganization(db, orgId);
  if (!organization) {
    return null;
  }

  const channelQuery = db
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const channelsResult = platformFilter
    ? await channelQuery.eq("platform", platformFilter)
    : await channelQuery;

  if (reportQueryError("channels", channelsResult.error)) {
    return null;
  }

  const channels = (channelsResult.data ?? []).map(toChannel);
  const channelIds = channels.map(channel => channel.id);
  const conversationsResult = channelIds.length
    ? await db
        .from("conversations")
        .select(CONVERSATION_COLUMNS)
        .eq("org_id", orgId)
        .in("channel_id", channelIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
    : { data: [], error: null };

  if (reportQueryError("conversations", conversationsResult.error)) {
    return null;
  }

  const conversations = (conversationsResult.data ?? []).map(toConversation);
  const conversationIds = conversations.map(conversation => conversation.id);

  const [usersResult, messagesResult, notesResult] = await Promise.all([
    db.from("org_users").select(ORG_USER_COLUMNS).eq("org_id", orgId).order("created_at", { ascending: true }),
    conversationIds.length
      ? db
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    conversationIds.length
      ? db
          .from("internal_notes")
          .select(NOTE_COLUMNS)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const)
  ]);

  if (
    reportQueryError("org_users", usersResult.error) ||
    reportQueryError("messages", messagesResult.error) ||
    reportQueryError("internal_notes", notesResult.error)
  ) {
    return null;
  }

  return clone({
    organization,
    users: (usersResult.data ?? []).map(toOrgUser),
    channels,
    conversations,
    messages: (messagesResult.data ?? []).map(toMessage),
    notes: (notesResult.data ?? []).map(toNote)
  });
}

function getDemoSnapshotSync(platformFilter?: Platform): StoreSnapshot {
  const state = getDemoState();
  const organization = state.organizations[0] ?? demoOrg;
  const channels = platformFilter
    ? state.channels.filter(channel => channel.platform === platformFilter)
    : state.channels;
  const channelIds = new Set(channels.map(channel => channel.id));
  const conversations = state.conversations.filter(conversation => channelIds.has(conversation.channelId));
  const conversationIds = new Set(conversations.map(conversation => conversation.id));
  const messages = state.messages.filter(message => conversationIds.has(message.conversationId));
  const notes = state.notes.filter(note => conversationIds.has(note.conversationId));

  return clone({
    organization,
    users: state.users,
    channels,
    conversations,
    messages,
    notes
  });
}

export async function getSnapshot(
  db: Db,
  orgId: string,
  platformFilter?: Platform
): Promise<StoreSnapshot> {
  // Demo data is a fallback for "no Supabase configured", not for "Supabase
  // returned an error" — mixing seeded rows into a live deployment hides real
  // failures behind plausible-looking content.
  if (!db) {
    return getDemoSnapshotSync(platformFilter);
  }

  const snapshot = await getOrgSnapshotFromSupabase(db, orgId, platformFilter);
  if (snapshot) {
    return snapshot;
  }

  const organization = await findOrganization(db, orgId);
  return {
    organization: organization ?? { ...demoOrg, id: orgId, name: "Unknown organization" },
    users: [],
    channels: [],
    conversations: [],
    messages: [],
    notes: []
  };
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function findChannel(db: Db, channelId: string): Promise<Channel | undefined> {
  if (!db) {
    return getDemoState().channels.find(channel => channel.id === channelId);
  }

  const { data, error } = await db
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("id", channelId)
    .maybeSingle<ChannelRow>();

  if (error || !data) {
    return undefined;
  }

  return toChannel(data);
}

export async function findChannelByPlatform(
  db: Db,
  orgId: string,
  platform: Platform
): Promise<Channel | undefined> {
  if (!db) {
    return getDemoState().channels.find(channel => channel.platform === platform);
  }

  const { data, error } = await db
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("org_id", orgId)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChannelRow>();

  if (error || !data) {
    return undefined;
  }

  return toChannel(data);
}

/**
 * Resolves the channel a webhook event belongs to. Matching on the platform's
 * own account id (Page id, WhatsApp phone number id, LINE destination) is what
 * keeps two accounts on the same platform from colliding. There is no org
 * context here — the channel row is what tells us which org the event belongs
 * to — so this must run on the service client.
 */
export async function findChannelForEvent(
  db: Db,
  platform: Platform,
  accountId?: string
): Promise<Channel | undefined> {
  if (!db) {
    const state = getDemoState();
    return (
      (accountId
        ? state.channels.find(
            channel => channel.platform === platform && channel.externalAccountId === accountId
          )
        : undefined) ?? state.channels.find(channel => channel.platform === platform)
    );
  }

  if (accountId) {
    const { data } = await db
      .from("channels")
      .select(CHANNEL_COLUMNS)
      .eq("platform", platform)
      .eq("external_account_id", accountId)
      .limit(1)
      .maybeSingle<ChannelRow>();

    if (data) {
      return toChannel(data);
    }
  }

  const { data } = await db
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChannelRow>();

  return data ? toChannel(data) : undefined;
}

export type ChannelInput = {
  orgId: string;
  platform: Platform;
  displayName: string;
  externalAccountId: string;
  /** Plaintext — encrypted here before it touches Postgres. */
  accessToken?: string;
  connectedBy?: string | null;
  status?: Channel["status"];
};

/**
 * Creates or refreshes a channel. Reconnecting the same platform account
 * updates the existing row rather than failing on the unique index, so an
 * expired token can be replaced without deleting the conversations attached
 * to it.
 *
 * Must be called with the service client: `access_token_encrypted` is revoked
 * from the `authenticated` role, so a user-scoped write of that column would be
 * rejected by Postgres.
 */
export async function upsertChannel(db: Db, input: ChannelInput): Promise<Channel> {
  if (!db) {
    const state = getDemoState();
    const existing = state.channels.find(
      channel =>
        channel.platform === input.platform &&
        channel.externalAccountId === input.externalAccountId
    );

    if (existing) {
      existing.displayName = input.displayName;
      existing.status = input.status ?? "active";
      return existing;
    }

    const channel: Channel = {
      id: randomUUID(),
      orgId: input.orgId,
      platform: input.platform,
      displayName: input.displayName,
      externalAccountId: input.externalAccountId,
      status: input.status ?? "active",
      connectedBy: input.connectedBy ?? null,
      createdAt: new Date().toISOString()
    };

    state.channels.push(channel);
    return channel;
  }

  const row: Record<string, unknown> = {
    org_id: input.orgId,
    platform: input.platform,
    display_name: input.displayName,
    external_account_id: input.externalAccountId,
    status: input.status ?? "active",
    connected_by: input.connectedBy ?? null
  };

  // Only overwrite the stored token when a new one was supplied, so renaming a
  // channel does not wipe its credentials.
  if (input.accessToken) {
    row.access_token_encrypted = encryptSecret(input.accessToken);
  }

  const existing = await db
    .from("channels")
    .select("id, org_id")
    .eq("platform", input.platform)
    .eq("external_account_id", input.externalAccountId)
    .maybeSingle<{ id: string; org_id: string }>();

  if (existing.data) {
    if (existing.data.org_id !== input.orgId) {
      throw new Error("That account is already connected to a different workspace.");
    }

    const { data, error } = await db
      .from("channels")
      .update(row)
      .eq("id", existing.data.id)
      .select(CHANNEL_COLUMNS)
      .single<ChannelRow>();

    if (error || !data) {
      throw error ?? new Error("Unable to update the channel");
    }

    return toChannel(data);
  }

  if (!input.accessToken) {
    throw new Error("An access token is required when connecting a new channel.");
  }

  const { data, error } = await db
    .from("channels")
    .insert(row)
    .select(CHANNEL_COLUMNS)
    .single<ChannelRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to create the channel");
  }

  return toChannel(data);
}

/** Non-credential edits. Safe on the user client, where RLS re-checks the role. */
export async function updateChannelSettings(
  db: Db,
  channelId: string,
  orgId: string,
  patch: { displayName?: string; status?: Channel["status"] }
): Promise<Channel | undefined> {
  if (!db) {
    const channel = getDemoState().channels.find(entry => entry.id === channelId);
    if (channel) {
      if (patch.displayName) channel.displayName = patch.displayName;
      if (patch.status) channel.status = patch.status;
    }
    return channel;
  }

  const { data } = await db
    .from("channels")
    .update({
      ...(patch.displayName ? { display_name: patch.displayName } : {}),
      ...(patch.status ? { status: patch.status } : {})
    })
    .eq("id", channelId)
    .eq("org_id", orgId)
    .select(CHANNEL_COLUMNS)
    .maybeSingle<ChannelRow>();

  return data ? toChannel(data) : undefined;
}

export async function deleteChannel(db: Db, channelId: string, orgId: string) {
  if (!db) {
    const state = getDemoState();
    state.channels = state.channels.filter(channel => channel.id !== channelId);
    return;
  }

  const { error } = await db.from("channels").delete().eq("id", channelId).eq("org_id", orgId);
  if (error) {
    throw error;
  }
}

/**
 * Loads a channel together with its decrypted credentials. The credential
 * columns are revoked from the `authenticated` role in Postgres, so this only
 * returns anything when called with the service client.
 */
export async function authorizeChannel(db: Db, channel: Channel): Promise<AuthorizedChannel> {
  if (!db) {
    return { ...channel, credentials: {} };
  }

  const { data } = await db
    .from("channels")
    .select("access_token_encrypted, webhook_secret")
    .eq("id", channel.id)
    .maybeSingle<{ access_token_encrypted: string | null; webhook_secret: string | null }>();

  return {
    ...channel,
    credentials: {
      accessToken: decryptSecret(data?.access_token_encrypted) ?? undefined,
      webhookSecret: decryptSecret(data?.webhook_secret) ?? undefined
    }
  };
}

// ---------------------------------------------------------------------------
// Conversations and messages
// ---------------------------------------------------------------------------

export async function findConversation(db: Db, conversationId: string): Promise<Conversation | undefined> {
  if (!db) {
    return getDemoState().conversations.find(conversation => conversation.id === conversationId);
  }

  const { data, error } = await db
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

/** Meta retries a webhook until it gets a 200, so ingestion must be idempotent. */
export async function messageExists(db: Db, platformMessageId: string): Promise<boolean> {
  if (!platformMessageId) {
    return false;
  }

  if (!db) {
    return getDemoState().messages.some(message => message.platformMessageId === platformMessageId);
  }

  const { data } = await db
    .from("messages")
    .select("id")
    .eq("platform_message_id", platformMessageId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  return Boolean(data);
}

/** Applies a delivery/read receipt to the outbound message it refers to. */
export async function updateMessageStatus(
  db: Db,
  platformMessageId: string,
  status: MessageStatus
): Promise<Message | undefined> {
  if (!db) {
    const message = getDemoState().messages.find(
      entry => entry.platformMessageId === platformMessageId
    );
    if (message) {
      message.status = status;
    }
    return message;
  }

  const { data } = await db
    .from("messages")
    .update({ status })
    .eq("platform_message_id", platformMessageId)
    .select(MESSAGE_COLUMNS)
    .maybeSingle<MessageRow>();

  return data ? toMessage(data) : undefined;
}

export async function getMessagesForConversation(db: Db, conversationId: string): Promise<Message[]> {
  if (!db) {
    return getDemoState()
      .messages.filter(message => message.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const { data, error } = await db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(toMessage);
}

export async function getNotesForConversation(db: Db, conversationId: string): Promise<InternalNote[]> {
  if (!db) {
    return getDemoState()
      .notes.filter(note => note.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const { data, error } = await db
    .from("internal_notes")
    .select(NOTE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(toNote);
}

export async function upsertConversation(db: Db, input: NewConversationInput): Promise<Conversation> {
  if (!db) {
    const state = getDemoState();
    const existing = state.conversations.find(
      conversation =>
        conversation.channelId === input.channelId &&
        conversation.externalContactId === input.externalContactId
    );

    if (existing) {
      if (input.contactName && existing.contactName !== input.contactName) {
        existing.contactName = input.contactName;
      }
      if (input.contactAvatarUrl && existing.contactAvatarUrl !== input.contactAvatarUrl) {
        existing.contactAvatarUrl = input.contactAvatarUrl;
      }
      return existing;
    }

    const conversation: Conversation = {
      id: randomUUID(),
      orgId: demoOrg.id,
      channelId: input.channelId,
      externalContactId: input.externalContactId,
      contactName: input.contactName || input.externalContactId,
      contactAvatarUrl: input.contactAvatarUrl,
      status: "open",
      createdAt: new Date().toISOString()
    };

    state.conversations.unshift(conversation);
    return conversation;
  }

  const channel = await findChannel(db, input.channelId);
  if (!channel) {
    throw new Error(`Channel ${input.channelId} not found`);
  }

  const existingResult = await db
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("channel_id", input.channelId)
    .eq("external_contact_id", input.externalContactId)
    .maybeSingle<ConversationRow>();

  if (existingResult.data) {
    const patch: Record<string, string> = {};
    if (input.contactName && existingResult.data.contact_name !== input.contactName) {
      patch.contact_name = input.contactName;
    }
    if (input.contactAvatarUrl && existingResult.data.contact_avatar_url !== input.contactAvatarUrl) {
      patch.contact_avatar_url = input.contactAvatarUrl;
    }

    if (Object.keys(patch).length === 0) {
      return toConversation(existingResult.data);
    }

    const { data } = await db
      .from("conversations")
      .update(patch)
      .eq("id", existingResult.data.id)
      .select(CONVERSATION_COLUMNS)
      .maybeSingle<ConversationRow>();

    return toConversation(data ?? { ...existingResult.data, ...patch });
  }

  const { data, error } = await db
    .from("conversations")
    .insert({
      org_id: channel.orgId,
      channel_id: input.channelId,
      external_contact_id: input.externalContactId,
      contact_name: input.contactName ?? input.externalContactId,
      contact_avatar_url: input.contactAvatarUrl ?? null,
      status: "open"
    })
    .select(CONVERSATION_COLUMNS)
    .single<ConversationRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to create conversation");
  }

  return toConversation(data);
}

export async function insertMessage(db: Db, input: NewMessageInput): Promise<Message> {
  if (!db) {
    const state = getDemoState();
    const message: Message = {
      id: randomUUID(),
      conversationId: input.conversationId,
      direction: input.direction,
      senderType: input.senderType,
      senderId: input.senderId ?? null,
      body: input.body,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      platformMessageId: input.platformMessageId,
      status: input.status ?? "sent",
      createdAt: new Date().toISOString()
    };

    state.messages.push(message);

    const conversation = state.conversations.find(entry => entry.id === input.conversationId);
    if (conversation) {
      conversation.lastMessageAt = message.createdAt;
      if (input.direction === "inbound") {
        conversation.status = "open";
        conversation.lastInboundAt = message.createdAt;
      }
    }

    return message;
  }

  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      direction: input.direction,
      sender_type: input.senderType,
      sender_id: input.senderId ?? null,
      body: input.body ?? null,
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
      platform_message_id: input.platformMessageId ?? null,
      status: input.status ?? "sent"
    })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to insert message");
  }

  await db
    .from("conversations")
    .update({
      last_message_at: data.created_at,
      // last_inbound_at anchors the WhatsApp 24-hour customer service window.
      ...(input.direction === "inbound"
        ? { status: "open", last_inbound_at: data.created_at }
        : {})
    })
    .eq("id", input.conversationId);

  return toMessage(data);
}

export async function addNote(
  db: Db,
  conversationId: string,
  authorId: string,
  body: string
): Promise<InternalNote> {
  if (!db) {
    const state = getDemoState();
    const note: InternalNote = {
      id: randomUUID(),
      conversationId,
      authorId,
      body,
      createdAt: new Date().toISOString()
    };
    state.notes.push(note);
    return note;
  }

  const { data, error } = await db
    .from("internal_notes")
    .insert({ conversation_id: conversationId, author_id: authorId, body })
    .select(NOTE_COLUMNS)
    .single<InternalNoteRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to insert note");
  }

  return toNote(data);
}

export async function updateConversationStatus(
  db: Db,
  conversationId: string,
  status: ConversationStatus
): Promise<Conversation | undefined> {
  if (!db) {
    const conversation = getDemoState().conversations.find(entry => entry.id === conversationId);
    if (conversation) {
      conversation.status = status;
    }
    return conversation;
  }

  const { data, error } = await db
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .select(CONVERSATION_COLUMNS)
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

export async function assignConversation(
  db: Db,
  conversationId: string,
  assignedAgentId: string | null
): Promise<Conversation | undefined> {
  if (!db) {
    const conversation = getDemoState().conversations.find(entry => entry.id === conversationId);
    if (conversation) {
      conversation.assignedAgentId = assignedAgentId;
    }
    return conversation;
  }

  const { data, error } = await db
    .from("conversations")
    .update({ assigned_agent_id: assignedAgentId })
    .eq("id", conversationId)
    .select(CONVERSATION_COLUMNS)
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

export async function getConversationBundle(db: Db, orgId: string, conversationId: string) {
  if (!db) {
    const state = getDemoState();
    const conversation = state.conversations.find(entry => entry.id === conversationId);
    if (!conversation) {
      return null;
    }

    const channel = state.channels.find(entry => entry.id === conversation.channelId) ?? null;

    return clone({
      organization: state.organizations[0] ?? demoOrg,
      users: state.users,
      channel,
      conversation,
      messages: state.messages
        .filter(message => message.conversationId === conversationId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      notes: state.notes
        .filter(note => note.conversationId === conversationId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    });
  }

  const conversation = await findConversation(db, conversationId);
  // RLS already hides conversations outside the caller's org, but an explicit
  // check keeps a mismatched id from ever resolving.
  if (!conversation || conversation.orgId !== orgId) {
    return null;
  }

  const [organization, users, channel, messages, notes] = await Promise.all([
    findOrganization(db, orgId),
    listOrgUsers(db, orgId),
    findChannel(db, conversation.channelId),
    getMessagesForConversation(db, conversationId),
    getNotesForConversation(db, conversationId)
  ]);

  if (!organization) {
    return null;
  }

  return clone({
    organization,
    users,
    channel: channel ?? null,
    conversation,
    messages,
    notes
  });
}

export async function summarizeInbox(db: Db, orgId: string) {
  if (!db) {
    const state = getDemoState();
    return {
      openCount: state.conversations.filter(conversation => conversation.status === "open").length,
      pendingCount: state.conversations.filter(conversation => conversation.status === "pending").length,
      unreadCount: state.messages.filter(message => message.direction === "inbound").length,
      activeChannels: state.channels.filter(channel => channel.status === "active").length
    };
  }

  const conversationIds =
    (await db.from("conversations").select("id").eq("org_id", orgId)).data?.map(entry => entry.id) ?? [];

  const [openResult, pendingResult, inboundResult, activeChannelsResult] = await Promise.all([
    db.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
    db.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    conversationIds.length
      ? db
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "inbound")
          .in("conversation_id", conversationIds)
      : Promise.resolve({ count: 0 } as const),
    db.from("channels").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active")
  ]);

  return {
    openCount: openResult.count ?? 0,
    pendingCount: pendingResult.count ?? 0,
    unreadCount: inboundResult.count ?? 0,
    activeChannels: activeChannelsResult.count ?? 0
  };
}
