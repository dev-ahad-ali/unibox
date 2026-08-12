import { randomUUID } from "node:crypto";
import { decryptSecret } from "@/lib/crypto";
import { demoChannels, demoConversations, demoMessages, demoNotes, demoOrg, demoUsers } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase";
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

type StoreSnapshot = {
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

const client = createServerSupabaseClient();

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

async function getActiveOrganizationRow() {
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("organizations")
    .select(ORGANIZATION_COLUMNS)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<OrganizationRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

async function getActiveOrganizationId() {
  const row = await getActiveOrganizationRow();
  return row?.id ?? demoOrg.id;
}

async function getOrgSnapshotFromSupabase(platformFilter?: Platform): Promise<StoreSnapshot | null> {
  if (!client) {
    return null;
  }

  const organizationRow = await getActiveOrganizationRow();
  if (!organizationRow) {
    return null;
  }

  const orgId = organizationRow.id;
  const channelQuery = client
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
    ? await client
        .from("conversations")
        .select(
          CONVERSATION_COLUMNS
        )
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
    client
      .from("org_users")
      .select(ORG_USER_COLUMNS)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    conversationIds.length
      ? client
          .from("messages")
          .select(
            MESSAGE_COLUMNS
          )
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    conversationIds.length
      ? client
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
    organization: toOrganization(organizationRow),
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

async function getSnapshot(platformFilter?: Platform): Promise<StoreSnapshot> {
  // Demo data is a fallback for "no Supabase configured", not for "Supabase
  // returned an error" — mixing seeded rows into a live deployment hides real
  // failures behind plausible-looking content.
  if (!client) {
    return getDemoSnapshotSync(platformFilter);
  }

  const snapshot = await getOrgSnapshotFromSupabase(platformFilter);
  if (snapshot) {
    return snapshot;
  }

  const organizationRow = await getActiveOrganizationRow();
  return {
    organization: organizationRow ? toOrganization(organizationRow) : { ...demoOrg, name: "Unknown organization" },
    users: [],
    channels: [],
    conversations: [],
    messages: [],
    notes: []
  };
}

export async function getDemoSnapshot(platformFilter?: Platform) {
  return getSnapshot(platformFilter);
}

export async function findConversation(conversationId: string): Promise<Conversation | undefined> {
  if (!client) {
    return getDemoState().conversations.find(conversation => conversation.id === conversationId);
  }

  const { data, error } = await client
    .from("conversations")
    .select(
      CONVERSATION_COLUMNS
    )
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

export async function findChannel(channelId: string): Promise<Channel | undefined> {
  if (!client) {
    return getDemoState().channels.find(channel => channel.id === channelId);
  }

  const { data, error } = await client
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("id", channelId)
    .maybeSingle<ChannelRow>();

  if (error || !data) {
    return undefined;
  }

  return toChannel(data);
}

export async function findChannelByPlatform(platform: Platform): Promise<Channel | undefined> {
  if (!client) {
    return getDemoState().channels.find(channel => channel.platform === platform);
  }

  const orgId = await getActiveOrganizationId();
  const { data, error } = await client
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
 * keeps two accounts on the same platform from colliding; the platform-only
 * lookup is a fallback for single-account setups and local testing.
 */
export async function findChannelForEvent(
  platform: Platform,
  accountId?: string
): Promise<Channel | undefined> {
  if (!accountId) {
    return findChannelByPlatform(platform);
  }

  if (!client) {
    const state = getDemoState();
    return (
      state.channels.find(
        channel => channel.platform === platform && channel.externalAccountId === accountId
      ) ?? state.channels.find(channel => channel.platform === platform)
    );
  }

  const { data } = await client
    .from("channels")
    .select(CHANNEL_COLUMNS)
    .eq("platform", platform)
    .eq("external_account_id", accountId)
    .limit(1)
    .maybeSingle<ChannelRow>();

  return data ? toChannel(data) : findChannelByPlatform(platform);
}

/**
 * Loads a channel together with its decrypted credentials. Server-only — the
 * result must never be returned to a page or serialized to the client.
 */
export async function authorizeChannel(channel: Channel): Promise<AuthorizedChannel> {
  if (!client) {
    return { ...channel, credentials: {} };
  }

  const { data } = await client
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

/** Meta retries a webhook until it gets a 200, so ingestion must be idempotent. */
export async function messageExists(platformMessageId: string): Promise<boolean> {
  if (!platformMessageId) {
    return false;
  }

  if (!client) {
    return getDemoState().messages.some(
      message => message.platformMessageId === platformMessageId
    );
  }

  const { data } = await client
    .from("messages")
    .select("id")
    .eq("platform_message_id", platformMessageId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  return Boolean(data);
}

/** Applies a delivery/read receipt to the outbound message it refers to. */
export async function updateMessageStatus(
  platformMessageId: string,
  status: MessageStatus
): Promise<Message | undefined> {
  if (!client) {
    const message = getDemoState().messages.find(
      entry => entry.platformMessageId === platformMessageId
    );
    if (message) {
      message.status = status;
    }
    return message;
  }

  const { data } = await client
    .from("messages")
    .update({ status })
    .eq("platform_message_id", platformMessageId)
    .select(MESSAGE_COLUMNS)
    .maybeSingle<MessageRow>();

  return data ? toMessage(data) : undefined;
}

export async function findUser(userId: string): Promise<OrgUser | undefined> {
  if (!client) {
    return getDemoState().users.find(user => user.id === userId);
  }

  const { data, error } = await client
    .from("org_users")
    .select(ORG_USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<OrgUserRow>();

  if (error || !data) {
    return undefined;
  }

  return toOrgUser(data);
}

export async function getMessagesForConversation(conversationId: string): Promise<Message[]> {
  if (!client) {
    return getDemoState().messages
      .filter(message => message.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const { data, error } = await client
    .from("messages")
    .select(
      MESSAGE_COLUMNS
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(toMessage);
}

export async function getNotesForConversation(conversationId: string): Promise<InternalNote[]> {
  if (!client) {
    return getDemoState().notes
      .filter(note => note.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const { data, error } = await client
    .from("internal_notes")
    .select(NOTE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(toNote);
}

export async function upsertConversation(input: NewConversationInput): Promise<Conversation> {
  if (!client) {
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

  const channel = await findChannel(input.channelId);
  const orgId = channel?.orgId ?? (await getActiveOrganizationId());

  const existingResult = await client
    .from("conversations")
    .select(
      CONVERSATION_COLUMNS
    )
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

    const { data } = await client
      .from("conversations")
      .update(patch)
      .eq("id", existingResult.data.id)
      .select(CONVERSATION_COLUMNS)
      .maybeSingle<ConversationRow>();

    return toConversation(data ?? { ...existingResult.data, ...patch });
  }

  const { data, error } = await client
    .from("conversations")
    .insert({
      org_id: orgId,
      channel_id: input.channelId,
      external_contact_id: input.externalContactId,
      contact_name: input.contactName ?? input.externalContactId,
      contact_avatar_url: input.contactAvatarUrl ?? null,
      status: "open"
    })
    .select(
      CONVERSATION_COLUMNS
    )
    .single<ConversationRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to create conversation");
  }

  return toConversation(data);
}

export async function insertMessage(input: NewMessageInput): Promise<Message> {
  if (!client) {
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

  const { data, error } = await client
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
    .select(
      MESSAGE_COLUMNS
    )
    .single<MessageRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to insert message");
  }

  await client
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

export async function addNote(conversationId: string, authorId: string, body: string): Promise<InternalNote> {
  if (!client) {
    const state = getDemoState();
    const note: InternalNote = {
      id: randomUUID(),
      conversationId,
      authorId,
      body,
      createdAt: new Date().toISOString()
    };
    state.notes.unshift(note);
    return note;
  }

  const { data, error } = await client
    .from("internal_notes")
    .insert({
      conversation_id: conversationId,
      author_id: authorId,
      body
    })
    .select(NOTE_COLUMNS)
    .single<InternalNoteRow>();

  if (error || !data) {
    throw error ?? new Error("Unable to insert note");
  }

  return toNote(data);
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<Conversation | undefined> {
  if (!client) {
    const conversation = getDemoState().conversations.find(entry => entry.id === conversationId);
    if (conversation) {
      conversation.status = status;
    }
    return conversation;
  }

  const { data, error } = await client
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .select(
      CONVERSATION_COLUMNS
    )
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

export async function assignConversation(
  conversationId: string,
  assignedAgentId: string | null
): Promise<Conversation | undefined> {
  if (!client) {
    const conversation = getDemoState().conversations.find(entry => entry.id === conversationId);
    if (conversation) {
      conversation.assignedAgentId = assignedAgentId;
    }
    return conversation;
  }

  const { data, error } = await client
    .from("conversations")
    .update({ assigned_agent_id: assignedAgentId })
    .eq("id", conversationId)
    .select(
      CONVERSATION_COLUMNS
    )
    .maybeSingle<ConversationRow>();

  if (error || !data) {
    return undefined;
  }

  return toConversation(data);
}

export async function getConversationBundle(conversationId: string) {
  if (!client) {
    const state = getDemoState();
    const conversation = state.conversations.find(entry => entry.id === conversationId);
    if (!conversation) {
      return null;
    }

    const channel = state.channels.find(entry => entry.id === conversation.channelId) ?? null;
    const messages = state.messages
      .filter(message => message.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const notes = state.notes
      .filter(note => note.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return clone({
      organization: state.organizations[0] ?? demoOrg,
      users: state.users,
      channel,
      conversation,
      messages,
      notes
    });
  }

  const conversation = await findConversation(conversationId);
  if (!conversation) {
    return null;
  }

  const [organizationRow, users, channel, messages, notes] = await Promise.all([
    getActiveOrganizationRow(),
    client
      .from("org_users")
      .select(ORG_USER_COLUMNS)
      .eq("org_id", conversation.orgId)
      .order("created_at", { ascending: true }),
    findChannel(conversation.channelId),
    getMessagesForConversation(conversationId),
    getNotesForConversation(conversationId)
  ]);

  if (!organizationRow || users.error) {
    return null;
  }

  return clone({
    organization: toOrganization(organizationRow),
    users: (users.data ?? []).map(toOrgUser),
    channel,
    conversation,
    messages,
    notes
  });
}

export async function summarizeInbox() {
  if (!client) {
    const state = getDemoState();
    const openCount = state.conversations.filter(conversation => conversation.status === "open").length;
    const pendingCount = state.conversations.filter(conversation => conversation.status === "pending").length;
    const unreadCount = state.messages.filter(message => message.direction === "inbound").length;
    const activeChannels = state.channels.filter(channel => channel.status === "active").length;

    return { openCount, pendingCount, unreadCount, activeChannels };
  }

  const orgId = await getActiveOrganizationId();
  const [openResult, pendingResult, inboundResult, activeChannelsResult] = await Promise.all([
    client.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
    client.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .in(
        "conversation_id",
        (
          await client
            .from("conversations")
            .select("id")
            .eq("org_id", orgId)
        ).data?.map(entry => entry.id) ?? []
      ),
    client.from("channels").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active")
  ]);

  return {
    openCount: openResult.count ?? 0,
    pendingCount: pendingResult.count ?? 0,
    unreadCount: inboundResult.count ?? 0,
    activeChannels: activeChannelsResult.count ?? 0
  };
}
