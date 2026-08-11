# Unibox

Unified social inbox starter built from `docs/base.md`.

This workspace now contains a runnable Next.js App Router scaffold with:

- a branded landing page,
- an inbox view with a live send-message path,
- admin pages for channels, agents, and analytics,
- webhook endpoints for Messenger, Instagram, WhatsApp, and LINE,
- a Supabase-backed repository layer with a demo fallback when env vars are missing,
- Supabase schema and RLS SQL for the real deployment path,
- Socket.io wiring for org/conversation live updates.

## What runs right now

With valid Supabase env vars, the app reads and writes your Postgres database through the server-side repository in `lib/store.ts`.

If the env vars are missing, the app falls back to seeded demo data so the UI still renders.

## Project layout

- `app/` - Next.js routes, UI pages, and API endpoints.
- `components/` - shared UI pieces.
- `lib/` - domain types, mock store, adapters, socket helpers, and Supabase client helpers.
- `supabase/` - schema and RLS SQL.
- `docs/base.md` - original build specification that this scaffold follows.

## How to run locally

1. Install dependencies.

```bash
npm install
```

2. Create your environment file from the sample.

```bash
cp .env.example .env.local
```

3. Start the app.

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Environment variables

The app can run in demo mode with no keys set. To connect real services, add these values to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL for browser socket connections and local callbacks. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes for Supabase mode | Supabase project URL used by the server-side client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional for now | Browser-safe key reserved for future client auth and public reads. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes for server-side DB access | Server-only Supabase key for privileged reads/writes. Never expose it to the browser. |
| `APP_ENCRYPTION_KEY` | yes for real channel credentials | Encryption key for `channels.access_token_encrypted` at rest. |
| `SESSION_SECRET` | recommended | Session/JWT signing secret if you add custom auth/session logic. |
| `META_APP_ID` | required for Messenger/Instagram | Meta app identifier. |
| `META_APP_SECRET` | required for Messenger/Instagram webhooks | Used to verify `X-Hub-Signature-256`. |
| `META_VERIFY_TOKEN` | required for Messenger/Instagram webhooks | Shared verify token for webhook challenge requests. |
| `META_PAGE_ACCESS_TOKEN` | required for Messenger/Instagram sending | Page/IG send token, kept server-side only. |
| `WHATSAPP_BSP_ACCOUNT_SID` | required for WhatsApp BSP | BSP account identifier, depending on Twilio/360dialog setup. |
| `WHATSAPP_BSP_AUTH_TOKEN` | required for WhatsApp BSP | BSP auth token. |
| `WHATSAPP_WEBHOOK_SECRET` | recommended for WhatsApp webhooks | Shared secret for verifying inbound callbacks in this scaffold. |
| `WHATSAPP_FROM_NUMBER` | required for WhatsApp sending | Provisioned WhatsApp sender number or BSP channel identifier. |
| `LINE_CHANNEL_ACCESS_TOKEN` | required for LINE sending | LINE Messaging API access token. |
| `LINE_CHANNEL_SECRET` | required for LINE webhook verification | Used to validate `X-Line-Signature`. |
| `LINE_VERIFY_TOKEN` | optional | Reserved for future setup flows if you want an extra shared challenge token. |

## Database setup

Run the SQL in this order:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql` for the starter org/channel rows

The schema follows the spec from `docs/base.md`:

- `organizations`
- `org_users`
- `channels`
- `conversations`
- `messages`
- `internal_notes`

RLS is set up so org membership determines visibility, with extra conversation visibility rules for agents and viewers.

Important: `channels.access_token_encrypted` is sensitive. Do not fetch that column in agent-facing queries. Even though RLS controls row visibility, the safest pattern is to only select that field in server-only code.

The app currently loads the first organization it finds. If your database is empty, insert at least one organization, one `org_users` row, and one channel row before testing the inbox.

## Webhook endpoints

The scaffold includes these routes:

- `/api/webhooks/messenger`
- `/api/webhooks/instagram`
- `/api/webhooks/whatsapp`
- `/api/webhooks/line`

Each webhook path currently does the following:

1. Verifies the request with the adapter for that platform.
2. Normalizes the payload into internal message objects.
3. Upserts a conversation by channel + external contact ID.
4. Inserts an inbound message.
5. Emits Socket.io events to the org and conversation rooms.

## Send-message path

The inbox composer posts to `/api/send-message`.

That route:

1. Loads the conversation.
2. Resolves the channel platform.
3. Chooses the platform adapter.
4. Sends the outbound message through the adapter.
5. Stores the outbound message in Postgres.
6. Emits a live update event.

## Auth and roles

The spec uses Supabase Auth plus `org_users.role`:

- `admin` - manage channels, agents, assignments, and analytics.
- `agent` - work assigned/unassigned conversations, reply, add notes.
- `viewer` - read-only.

This scaffold does not yet implement the full auth flow. It is structured so auth can be added without changing the core inbox data model.

## Current limitations

- Adapter send methods still return stubbed platform message IDs rather than calling real provider APIs.
- WhatsApp is abstracted at the BSP level but not bound to a specific provider yet.
- Assignment, internal notes, and channel setup are represented in UI/data shape, but the full CRUD flow is not wired.

## Next implementation steps

1. Add Supabase Auth pages and org invite flow.
2. Implement real Meta OAuth + webhook signing for Messenger/Instagram.
3. Connect a real WhatsApp BSP.
4. Wire admin CRUD for channels and agents.
5. Add note creation and assignment actions in the inbox.

## Notes for production

- Keep service role keys server-only.
- Encrypt channel access tokens before writing them to Postgres.
- Keep webhook verification strict per provider.
- Treat direct channel message sending as a server-only operation.
- Add audit logging before allowing destructive admin actions.
