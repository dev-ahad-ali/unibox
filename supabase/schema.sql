create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists org_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  auth_user_id uuid not null,
  role text not null check (role in ('admin', 'agent', 'viewer')),
  display_name text,
  created_at timestamptz default now()
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  platform text not null check (platform in ('messenger', 'instagram', 'whatsapp', 'line')),
  display_name text,
  external_account_id text not null,
  access_token_encrypted text not null,
  webhook_secret text,
  status text default 'active' check (status in ('active', 'disconnected', 'error')),
  connected_by uuid references org_users(id),
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  external_contact_id text not null,
  contact_name text,
  contact_avatar_url text,
  assigned_agent_id uuid references org_users(id),
  status text default 'open' check (status in ('open', 'pending', 'closed')),
  last_message_at timestamptz,
  -- Anchors the WhatsApp 24-hour customer service window.
  last_inbound_at timestamptz,
  created_at timestamptz default now(),
  unique(channel_id, external_contact_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'agent', 'system')),
  sender_id uuid references org_users(id),
  body text,
  media_url text,
  media_type text,
  platform_message_id text,
  status text default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
  created_at timestamptz default now()
);

create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  author_id uuid references org_users(id),
  body text not null,
  created_at timestamptz default now()
);

-- Migration helper for databases created before last_inbound_at existed.
alter table conversations add column if not exists last_inbound_at timestamptz;

-- Pending invitations. The token is the credential an invitee presents at
-- /join/<token>, so it must be unguessable and single-use.
create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'agent', 'viewer')),
  token text not null unique,
  invited_by uuid references org_users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz default now()
);

-- One membership per auth user. Without this, a replayed invite acceptance
-- could attach the same person to an org twice.
create unique index if not exists idx_org_users_auth_user on org_users(auth_user_id);

create index if not exists idx_org_invites_org on org_invites(org_id);
create index if not exists idx_org_users_org on org_users(org_id);
create index if not exists idx_channels_org on channels(org_id);
-- One row per platform account: webhook routing matches on this pair.
create unique index if not exists idx_channels_platform_account
  on channels(platform, external_account_id);
-- Platforms redeliver webhooks until they see a 200, so ingestion has to be
-- idempotent on the platform's own message id.
create unique index if not exists idx_messages_platform_id
  on messages(platform_message_id)
  where platform_message_id is not null;
create index if not exists idx_conversations_org on conversations(org_id);
create index if not exists idx_conversations_channel_contact on conversations(channel_id, external_contact_id);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_notes_conversation on internal_notes(conversation_id, created_at);
