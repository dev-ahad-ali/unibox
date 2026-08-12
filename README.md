# Unibox

Unified social inbox starter built from `docs/base.md`.

This workspace contains a runnable Next.js App Router scaffold with:

- an overview page and an agent inbox (shadcn/ui, Tailwind v4, black + lime theme),
- admin pages for channels, agents, and analytics,
- webhook endpoints for Messenger, Instagram, WhatsApp, and LINE,
- working send paths for all four platforms,
- a Supabase-backed repository layer with a demo fallback when env vars are missing,
- Supabase schema and RLS SQL for the real deployment path,
- Socket.io wiring for org/conversation live updates.

## What runs right now

With valid Supabase env vars, the app reads and writes your Postgres database through the server-side repository in `lib/store.ts`.

If `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, the app runs on seeded demo data so the UI still renders. When Supabase *is* configured but a query fails, the app returns empty results and logs the error rather than substituting demo rows — a silent fallback makes a broken query look like an empty inbox.

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
| `WHATSAPP_ACCESS_TOKEN` | required for WhatsApp sending | Meta Cloud API access token. Keep it server-side only. |
| `WHATSAPP_PHONE_NUMBER_ID` | required for WhatsApp sending | Meta Cloud API phone-number ID, not the phone number itself. |
| `WHATSAPP_VERIFY_TOKEN` | required for WhatsApp webhooks | Secret value you choose and enter in Meta's webhook configuration. |
| `META_GRAPH_API_VERSION` | recommended | Meta Graph API version used for WhatsApp sends; update it before Meta retires the selected version. |
| `LINE_CHANNEL_ACCESS_TOKEN` | required for LINE sending | LINE Messaging API access token. |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | optional | Separate Instagram send token. Falls back to `META_PAGE_ACCESS_TOKEN`. |
| `LINE_CHANNEL_SECRET` | required for LINE webhooks | Used to validate `X-Line-Signature`. Without it, LINE webhooks are rejected. |

`APP_ENCRYPTION_KEY` must decode to 32 bytes — generate one with `openssl rand -hex 32`. Access tokens for a channel are read from `channels.access_token_encrypted` (decrypted with that key) and fall back to the platform env var when the column holds no usable value.

## Database setup

Run the SQL in this order:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql` for the starter org/channel rows

Both `schema.sql` and `rls.sql` are idempotent — re-run them after pulling changes, in that order (`rls.sql` references the `org_invites` table that `schema.sql` creates).

`rls.sql` fixes two problems in the original policies. The `current_org_id()` helpers now run as `SECURITY DEFINER`: they read `org_users`, and the policy on `org_users` calls them, so without it Postgres aborts with *infinite recursion detected in policy for relation org_users*. And the `FOR ALL` policies were split into separate insert/update/delete policies — because permissive policies are OR'd together, a `FOR ALL` policy also granted `SELECT`, which handed agents read access to every conversation in the org and made the visibility rule above it dead code.

`schema.sql` is idempotent, so re-run it after pulling changes. It adds `conversations.last_inbound_at` (the WhatsApp 24-hour window anchor) and two unique indexes: one on `(platform, external_account_id)` for webhook routing, and one on `messages.platform_message_id` so redelivered webhooks cannot duplicate a message.

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

## Connecting channels

`/admin/channels` (admins only) has two paths.

### Connect with Meta

One Facebook login covers Messenger, Instagram, and WhatsApp:

1. `/admin/channels/connect/meta` sets a CSRF `state` cookie and redirects to the Facebook login dialog.
2. The callback verifies `state` with a constant-time compare, exchanges the code for a user token, and **upgrades it to a long-lived token** — a short-lived one expires in about an hour and would take every stored Page token with it. The token is parked in an encrypted, httpOnly cookie (15 min TTL), so it never reaches the browser in readable form.
3. The picker lists every Page, linked Instagram Business account, and WhatsApp phone number the login can manage. Assets are **re-fetched server-side on submit** rather than trusted from the form, so a client cannot post an account it was never authorized for.
4. Each connected Page is subscribed to `messages`, `messaging_postbacks`, `message_deliveries`, and `message_reads`. Skipping this is the most common reason a "connected" Messenger channel never receives anything.

Add this to **Valid OAuth Redirect URIs** in the Meta app dashboard first:

```
<NEXT_PUBLIC_APP_URL>/admin/channels/connect/meta/callback
```

Asset discovery is per-product and failure-tolerant: an app without WhatsApp permissions still lists and connects its Pages, and the reason the other product failed is shown as a warning.

### Connect manually

For LINE (which has no OAuth) and for Meta accounts where you would rather paste a System User token. The form relabels its fields per platform, because the id each one wants differs and getting it wrong is the usual setup mistake:

| Platform | `external_account_id` |
| --- | --- |
| Messenger | Facebook Page id |
| Instagram | Instagram Business account id (not the @handle) |
| WhatsApp | Phone number id (not the phone number) |
| LINE | Bot user id — the `userId` from `GET /v2/bot/info`, which arrives as `destination` on every webhook |

**The token is verified against the live platform API before it is stored.** Saving an unusable credential would leave a channel that looks connected and silently drops every reply.

### Managing a channel

- **Test** re-verifies the stored credential and writes the result back to `status`, so the list reflects reality rather than a stale `active` from whenever it was first connected.
- **Disconnect** sets `status = disconnected` and keeps all history.
- **Delete** removes the row — and `conversations`/`messages` cascade from it, so the UI confirms first.

Reconnecting an account that already exists updates the row in place instead of failing on the `(platform, external_account_id)` unique index, so an expired token can be swapped without losing conversations. Renaming a channel does not touch its stored token.

Tokens are encrypted with AES-256-GCM under `APP_ENCRYPTION_KEY` before they reach Postgres, and the credential columns are revoked from the `authenticated` role — so channel writes that touch a token run on the service client, while renames, status changes, and deletes go through the user client where RLS re-checks the admin role.

## Webhook endpoints

The scaffold includes these routes:

- `/api/webhooks/messenger`
- `/api/webhooks/instagram`
- `/api/webhooks/whatsapp`
- `/api/webhooks/line`

Each webhook path currently does the following:

1. Verifies the signature with the adapter for that platform, against the raw request body.
2. Normalizes the payload into internal messages and delivery receipts.
3. Resolves the `channels` row by the platform's own account id (Page id, WhatsApp `phone_number_id`, LINE `destination`), falling back to the first channel on that platform.
4. Skips any message whose `platform_message_id` is already stored, since platforms redeliver until they get a 200.
5. Upserts a conversation and inserts the inbound message.
6. Applies delivery/read receipts to previously sent messages.
7. Emits Socket.io events to the org and conversation rooms.
8. Returns 200 immediately; contact profile lookups run detached.

Signature verification is mandatory. If `META_APP_SECRET` (Meta) or `LINE_CHANNEL_SECRET` (LINE) is unset, the corresponding webhook rejects every request rather than accepting unsigned payloads.

Messenger and Instagram echo events (`message.is_echo`) are dropped — they are the app's own outbound replies coming back, and ingesting them would duplicate every agent reply as a customer message.

### WhatsApp Cloud API development setup

1. In the Meta developer dashboard, add **WhatsApp** to your app and open **WhatsApp > API Setup**.
2. Copy the temporary access token and phone-number ID into `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in `.env.local`.
3. Set `WHATSAPP_VERIFY_TOKEN` to a long random value. In Meta's webhook settings, use `https://your-public-url/api/webhooks/whatsapp` as the callback URL and enter the same value as the verify token.
4. Subscribe to the `messages` webhook field. Meta signs POST requests with `META_APP_SECRET`; set that variable so production callbacks are verified.
5. Add your personal WhatsApp number as a test recipient in **API Setup**, then send a message from that number to Meta's test sender number. The message should appear in the inbox.

For local development, expose the dev server with an HTTPS tunnel such as Cloudflare Tunnel or ngrok and use that public URL for the webhook. The Meta test number can only communicate with allow-listed test recipients. Outbound free-form messages are subject to WhatsApp's customer-service window; template messages are required outside it.

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

- Invites are not emailed — the admin copies the `/join/<token>` link manually.
- WhatsApp channels connected through OAuth store the long-lived **user** token, which expires in about 60 days. Use a System User token via manual connect for a credential that does not rotate.
- Meta permissions like `pages_messaging` need App Review before the connect flow works for accounts outside your app's development roles.
- One workspace per account. Accepting an invite while already a member of another org is rejected rather than supported.
- Assignment, internal notes, and channel setup render read-only; the CRUD actions are not wired.
- WhatsApp sends text only. Template messages (needed outside the 24-hour window) and media sends are not implemented.
- LINE webhook verification uses a single `LINE_CHANNEL_SECRET`, so one LINE channel per deployment. Meta platforms sign with one app secret and support multiple accounts already.
- `/api/media/whatsapp/[mediaId]` proxies WhatsApp media and is unauthenticated, like the rest of the app.

## Next implementation steps

1. Add the Meta OAuth connect flow so admins can attach a Page/IG account without hand-writing rows.
2. Send invite emails instead of surfacing a copyable link.
3. Implement template and media sends for WhatsApp Cloud API.
4. Wire admin CRUD for channels.
5. Add note creation and assignment actions in the inbox.

## Notes for production

- Keep service role keys server-only.
- Encrypt channel access tokens before writing them to Postgres.
- Keep webhook verification strict per provider.
- Treat direct channel message sending as a server-only operation.
- Add audit logging before allowing destructive admin actions.
