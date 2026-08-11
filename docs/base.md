# Unified Social Inbox — Phase 1 Build Spec

**Channels:** Facebook Messenger, Instagram DM, WhatsApp, LINE
**Stack:** Next.js (App Router) + Postgres (Supabase) + Supabase Auth + Socket.io
**Deferred:** WeChat (see notes at bottom)

Hand this whole file to Claude Code as the starting spec. Build in the order listed — each phase should be a working, testable slice.

---

## 1. Database Schema

```sql
-- Organizations (multi-tenant from day 1, even if you only run one)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Users (admins + agents)
create table org_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  auth_user_id uuid not null, -- maps to Supabase auth.users
  role text not null check (role in ('admin','agent','viewer')),
  display_name text,
  created_at timestamptz default now()
);

-- Connected channels (one row per connected social account)
create table channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  platform text not null check (platform in ('messenger','instagram','whatsapp','line')),
  display_name text, -- e.g. "Japan Airbnb - Messenger"
  external_account_id text not null, -- page id / phone number id / line channel id
  access_token_encrypted text not null, -- ALWAYS encrypted at rest, never exposed to agents
  webhook_secret text,
  status text default 'active' check (status in ('active','disconnected','error')),
  connected_by uuid references org_users(id),
  created_at timestamptz default now()
);

-- Conversations (one thread per customer per channel)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  external_contact_id text not null, -- platform-specific customer id
  contact_name text,
  contact_avatar_url text,
  assigned_agent_id uuid references org_users(id),
  status text default 'open' check (status in ('open','pending','closed')),
  last_message_at timestamptz,
  created_at timestamptz default now(),
  unique(channel_id, external_contact_id)
);

-- Messages (normalized across all platforms)
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','agent','system')),
  sender_id uuid references org_users(id), -- null for customer messages
  body text,
  media_url text,
  media_type text, -- image, video, audio, file
  platform_message_id text,
  status text default 'sent' check (status in ('sent','delivered','read','failed')),
  created_at timestamptz default now()
);

-- Internal notes (agent-only, never sent to customer)
create table internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  author_id uuid references org_users(id),
  body text not null,
  created_at timestamptz default now()
);

create index idx_conversations_org on conversations(org_id);
create index idx_messages_conversation on messages(conversation_id, created_at);
```

**Row-Level Security:** enable RLS on every table, scope by `org_id` matched against the caller's `org_users` row. Agents should only ever query through Postgres policies that also filter to conversations assigned to them or unassigned+open, depending on how open you want visibility.

---

## 2. Auth & RBAC

- Supabase Auth handles login (email/password or magic link to start; add SSO later if needed).
- `org_users.role` drives what the UI shows:
  - **admin** — connect/disconnect channels, invite/remove agents, see all conversations, reassign, view analytics.
  - **agent** — see only assigned/unassigned conversations in their org, reply, add internal notes. No access to `channels.access_token_encrypted` — never fetch that column in any agent-facing query.
  - **viewer** — read-only, for reporting.
- All platform credentials live only in `channels.access_token_encrypted`, decrypted server-side only, inside API routes/webhook handlers. Never send tokens to the client.

---

## 3. Channel Adapter Interface

Every platform gets a folder under `/adapters/{platform}/` implementing the same interface, so adding a platform later doesn't touch core logic.

```typescript
interface ChannelAdapter {
  verifyWebhook(req: Request): boolean;
  parseIncoming(payload: any): NormalizedMessage[];
  sendMessage(channel: Channel, externalContactId: string, message: OutboundMessage): Promise<{ platformMessageId: string }>;
  fetchContactProfile?(channel: Channel, externalContactId: string): Promise<{ name: string; avatarUrl?: string }>;
}

interface NormalizedMessage {
  externalContactId: string;
  contactName?: string;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  platformMessageId: string;
  timestamp: Date;
}
```

### Platform specifics

**Messenger + Instagram** (`/adapters/messenger`, `/adapters/instagram`)
- Both run on Meta's Graph API — one Meta App with both products enabled, one webhook subscription covers both, so build one shared Meta client and two thin adapters over it.
- OAuth flow: admin connects their Facebook Page (which brings the linked Instagram Business account with it).
- Webhook verify: `hub.verify_token` GET challenge, then POST payloads signed with `X-Hub-Signature-256`.
- Send via `POST /me/messages` (Messenger) and `POST /{ig-user-id}/messages` (Instagram).

**WhatsApp** (`/adapters/whatsapp`)
- Use a BSP (Twilio or 360dialog) instead of raw Cloud API for phase 1 — faster number provisioning, less Meta Business verification friction.
- Webhook receives inbound messages + delivery status callbacks.
- Send via BSP's send-message API; respect the 24-hour customer service window (outside it, only pre-approved template messages are allowed — flag this in the UI so agents know when they need a template).

**LINE** (`/adapters/line`)
- LINE Messaging API + Official Account.
- Webhook signature verification via `X-Line-Signature` (HMAC-SHA256 against channel secret).
- Send via `POST /v2/bot/message/push`.

---

## 4. Webhook Endpoints

```
/api/webhooks/messenger
/api/webhooks/instagram
/api/webhooks/whatsapp
/api/webhooks/line
```

Each route:
1. Verifies signature using that adapter's `verifyWebhook()`.
2. Calls `parseIncoming()` to normalize.
3. Upserts `conversations` (match on `channel_id` + `external_contact_id`, create if new).
4. Inserts `messages` row.
5. Emits a Socket.io event (`new_message`) to the org's room so the inbox UI updates live.
6. Returns 200 fast — do heavy work (e.g. contact profile fetch) async, don't block the webhook ack.

---

## 5. Admin Console

Pages:
- `/admin/channels` — list connected channels, "Connect" button per platform triggers that platform's OAuth/setup flow, shows status (active/error).
- `/admin/agents` — invite agents by email, assign roles, deactivate.
- `/admin/analytics` (optional phase 1.5) — response time, volume by channel.

---

## 6. Agent Inbox UI

- `/inbox` — left pane: conversation list (avatar, platform badge icon, last message preview, unread indicator), filterable by channel/status/assigned-to-me.
- Center: thread view, message bubbles, platform icon per message.
- Right pane: contact info, internal notes, assign/reassign, close conversation.
- Reply box: send button posts to `/api/send-message`, which looks up the right adapter and calls `sendMessage()`.
- Socket.io client subscribes to org room, live-updates conversation list + open thread.

---

## Build Order for Claude Code

1. Schema + Supabase project + RLS policies.
2. Auth: signup, org creation, invite flow.
3. Messenger adapter end-to-end (webhook → DB → send) — get one full loop working before adding more.
4. Admin console: connect Messenger via OAuth.
5. Basic inbox UI reading from DB (no realtime yet).
6. Add Socket.io for realtime.
7. Add Instagram adapter (shares Meta client with Messenger — should be fast).
8. Add WhatsApp adapter (BSP).
9. Add LINE adapter.
10. Internal notes, conversation assignment, closing/reopening.
11. Polish: typing indicators, read receipts where platforms support them, media handling.

---

## WeChat (Phase 2 note)

Full WeChat Official Account API access (direct customer messaging, ads) requires a China-registered entity or an ICP-filed presence. Two non-entity paths to test demand first:
- **Unverified/Subscription Account** — no China entity needed, but limited to one-way content push, no messaging API, no ad platform access.
- **Partner with a China-based WeChat agency/reseller** — they run the Official Account + ads under their entity; you keep control of content/targeting.

Only build a WeChat adapter into this app once you're running through your own Verified Service Account with API access (i.e., after entity decision is made).
