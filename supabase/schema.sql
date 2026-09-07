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
  platform text not null check (platform in ('messenger', 'instagram', 'whatsapp', 'line', 'telegram')),
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

-- `create table if not exists` never updates an existing table, so the platform
-- list is re-asserted here for deployments created before Telegram support.
-- Idempotent: drops and recreates the same constraint.
alter table channels drop constraint if exists channels_platform_check;
alter table channels add constraint channels_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp', 'line', 'telegram'));

-- Webhook delivery log. One row per inbound webhook call — the observable
-- record behind "is this channel actually receiving events?". Written by the
-- service role during ingestion; read by admins on the channels screen.
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_account_id text,
  channel_id uuid references channels(id) on delete set null,
  org_id uuid references organizations(id) on delete cascade,
  outcome text not null check (outcome in ('ingested', 'duplicate', 'unmatched', 'invalid_signature', 'malformed', 'empty')),
  message_count int not null default 0,
  received_at timestamptz default now()
);

create index if not exists idx_webhook_events_channel on webhook_events(channel_id, received_at desc);
create index if not exists idx_webhook_events_org on webhook_events(org_id, received_at desc);

-- Per-organization platform app credentials. Before this table the Meta app id,
-- app secret, and verify token were deployment-level env vars, which meant one
-- Meta developer app per deployment — so every tenant needed their own copy of
-- Unibox. Storing them per org lets one deployment serve tenants that each
-- bring their own Meta app. Secrets are AES-256-GCM encrypted by the app, never
-- stored in plaintext, and never exposed to the `authenticated` role.
create table if not exists org_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null check (provider in ('meta')),
  -- Public identifier, safe to show in the dashboard.
  app_id text,
  app_secret_encrypted text,
  verify_token_encrypted text,
  -- Meta's "Instagram API with Instagram Login" product signs its webhooks with
  -- a second secret, separate from the app secret on Basic Settings.
  instagram_app_secret_encrypted text,
  updated_by uuid references org_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_org_credentials_org on org_credentials(org_id);

-- Data deletion requests received from Meta's Data Deletion Request Callback.
-- Meta requires the callback to answer with a confirmation code and a URL where
-- the person can check on the request, so the code has to outlive the request
-- that created it. Written and read only by the service role: the status page
-- is public and looks a row up by its unguessable code, which is the whole
-- credential — no session is involved.
create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  org_id uuid references organizations(id) on delete cascade,
  -- App-scoped user id from the signed request. Not a Page-scoped id, so it
  -- will often match nothing here; that outcome is recorded as 'no_data'.
  external_user_id text not null,
  conversations_deleted int not null default 0,
  status text not null default 'completed' check (status in ('completed', 'no_data')),
  requested_at timestamptz default now()
);

create index if not exists idx_deletion_requests_org on deletion_requests(org_id, requested_at desc);
