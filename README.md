# Unibox

A unified social inbox. Customer messages from **Facebook Messenger, Instagram DM, WhatsApp, and LINE** land in one shared queue, and your team answers them all from one screen without switching apps or logging into four dashboards.

Built from the specification in [`docs/base.md`](docs/base.md).

---

## Contents

- [What it does](#what-it-does)
- [Using Unibox](#using-unibox) — the day-to-day guide
- [Stack and architecture](#stack-and-architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Connecting channels](#connecting-channels)
- [Receiving messages: webhooks](#receiving-messages-webhooks)
- [Sending messages](#sending-messages)
- [Security model](#security-model)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Roadmap](#roadmap)

---

## What it does

- **One inbox, four platforms.** Messenger, Instagram, WhatsApp, and LINE conversations in a single list, filterable by channel and status.
- **Real two-way messaging.** Inbound webhooks write to Postgres; replies go back out through each platform's own API.
- **Live updates.** Socket.io pushes new messages to open browsers without a refresh.
- **Multi-tenant from day one.** Every row is scoped to an organization, enforced by Postgres row-level security.
- **Roles.** Admins manage the workspace, agents answer messages, viewers read and report.
- **Credentials encrypted at rest.** Platform tokens are AES-256-GCM encrypted and unreadable to anyone but the server.

---

## Using Unibox

This section is the user guide. It assumes the app is already deployed and the database is set up — if not, start at [Setup](#setup).

### Getting in

**If you are starting a new workspace**, go to `/signup`. Enter a workspace name, your name, email, and a password. You become the workspace's first **admin**. If your Supabase project has email confirmation enabled, check your inbox for the link before signing in.

**If someone invited you**, they will send you a link that looks like `https://your-app/join/AbC123…`. Open it, pick a password, and you are in with whatever role they assigned. The link works once and expires after 7 days.

Afterwards, sign in at `/login`. Sessions persist; sign out from the button next to your name at the bottom of the sidebar.

### What each role can do

| | Admin | Agent | Viewer |
| --- | :---: | :---: | :---: |
| See the inbox | all conversations | assigned + unassigned-and-open | all conversations |
| Send replies | ✅ | ✅ | ❌ |
| Connect / manage channels | ✅ | ❌ | ❌ |
| Invite people, change roles | ✅ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ✅ |

Navigation is filtered by role, so agents never see admin destinations at all.

### For admins: first-run checklist

1. **Sign up** at `/signup` — this creates the workspace.
2. **Connect a channel** at `/admin/channels`. See [Connecting channels](#connecting-channels). Nothing arrives in the inbox until at least one channel exists.
3. **Point the platform's webhook** at your app. See [Receiving messages](#receiving-messages-webhooks). This is the step people forget — a connected channel with no webhook stays silent forever.
4. **Send yourself a test message** from a real account on that platform. It should appear in `/inbox` within a second or two.
5. **Invite your team** at `/admin/agents`.

### For admins: inviting your team

Go to `/admin/agents`, enter an email, pick a role, and press **Create invite**. You get a `/join/<token>` link.

> **Unibox does not send the email.** Copy the link and send it however you normally would. Wiring an email provider is the one remaining step here.

The same page lists current members — change someone's role from the dropdown — and pending invites, which you can revoke. You cannot remove your own admin role, so a workspace can never lock itself out.

### For agents: working the inbox

`/inbox` is a three-pane screen.

**Left — the queue.** Every conversation, newest activity first. Each row shows the contact, the platform icon, and a status dot. Two filter rows sit above it: status (All / Open / Pending / Closed) and channel (All / Messenger / Instagram / WhatsApp / LINE). Filters combine, and they live in the URL — so a filtered view is a bookmarkable, shareable link.

**Centre — the thread.** Full history with the customer, oldest at top. Your team's replies are the lime bubbles on the right; the customer's are bordered on the left. Each message shows its timestamp and delivery state (`sent` → `delivered` → `read`, or `failed`).

**Right — context.** Contact name and platform id, which channel it came in on, who it is assigned to, when the customer last wrote, and any internal notes. Notes are staff-only and are never sent to the customer.

**Replying.** Type in the box at the bottom. **Enter sends, Shift+Enter adds a line.** If the platform rejects the message, the error is shown and *no message bubble is added* — you will never see a reply that looks delivered but never arrived.

**The status dot** means: lime = open, amber = pending, grey = closed.

### The WhatsApp 24-hour window

WhatsApp only allows free-form replies for **24 hours after the customer's last message**. Outside that window Meta rejects anything but a pre-approved template.

Unibox shows this above the reply box on WhatsApp conversations:

- *Inside the window* — a quiet note with roughly how many hours remain.
- *Outside it* — an amber warning, and the composer is disabled.

The check also runs server-side, so the window cannot be bypassed by any client. The countdown restarts every time the customer writes again.

### Live updates

The pill in the top-right shows the realtime connection: **live**, **connecting**, or **offline**. While it says *live*, new messages appear on their own. If it says *offline*, you are still working normally — you just need to refresh to see new arrivals.

---

## Stack and architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, server components) |
| Database | Supabase Postgres, with row-level security |
| Auth | Supabase Auth (email + password), cookie sessions via `@supabase/ssr` |
| Realtime | Socket.io on a custom Node server (`server.js`) |
| UI | Tailwind CSS v4 + shadcn/ui, black and lime theme, dark by default |
| Language | TypeScript, strict |

### Layout

```
app/
  (auth)/          login, signup, join/[token] — the only public pages
  admin/           channels, agents, analytics (admin/viewer only)
  inbox/           the agent inbox
  api/
    webhooks/      one route per platform — signature-authenticated
    send-message/  outbound replies
    media/         authenticated WhatsApp media proxy
    health/        liveness + config probe
components/
  ui/              shadcn primitives
lib/
  adapters/        per-platform integrations (see below)
  auth.ts          session + role guards
  store.ts         every database query
  crypto.ts        AES-256-GCM for stored credentials
  webhooks.ts      shared inbound pipeline
middleware.ts      session refresh + route gating
supabase/          schema.sql, rls.sql, seed.sql
```

### The adapter pattern

Every platform implements one interface (`ChannelAdapter` in `lib/types.ts`), so adding a fifth platform never touches the inbox, the store, or the UI:

```ts
verifyWebhook(context)                              // is this really from the platform?
parseIncoming(payload)  -> { messages, statuses }   // normalize to our shape
sendMessage(channel, contactId, message)            // reply
fetchContactProfile?(channel, contactId)            // optional enrichment
verifyCredentials(channel)                          // is the stored token still good?
```

- `lib/adapters/graph.ts` — shared Meta Graph client. Messenger, Instagram, and WhatsApp all run on it and are signed by the same app secret, so transport, signature checking, and error shape live there once.
- `lib/adapters/meta.ts` — Messenger and Instagram.
- `lib/adapters/whatsapp.ts` — WhatsApp Cloud API.
- `lib/adapters/line.ts` — LINE Messaging API.
- `lib/adapters/meta-connect.ts` — the OAuth handshake, kept separate from message handling.

### Data model

`organizations` → `org_users` (membership + role) → `channels` (connected accounts) → `conversations` (one per customer per channel) → `messages`, plus `internal_notes` and `org_invites`.

Every query goes through `lib/store.ts`, which takes its Supabase client as an explicit argument — user-scoped for anything a person triggers, service-role only where documented.

### Demo mode

With no Supabase env vars, the app runs on seeded in-memory data as a stand-in admin and gates nothing. The sidebar shows a warning while this is active. It exists so the UI is explorable without any backend, and it is unreachable once Supabase is configured.

> Deploying with missing Supabase env vars silently produces an open app. Set them, or do not deploy.

---

## Setup

**Requirements:** Node 20+ (developed on 24), pnpm, and a Supabase project.

```bash
pnpm install
cp .env.example .env.local     # then fill it in — see below
pnpm dev                       # http://localhost:3000
```

| Script | Does |
| --- | --- |
| `pnpm dev` | Dev server with Socket.io attached |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm typecheck` | `tsc --noEmit` |

`pnpm dev` runs `server.js`, not `next dev` — the custom server is what attaches Socket.io to the same port.

On start it prints which mode it is in:

```
[unibox] Supabase configured — sessions and socket auth are active.
[unibox] Supabase is not configured — running in demo mode with no auth.
```

---

## Environment variables

Copy `.env.example` to `.env.local`. It is gitignored, along with `.env.*`.

### Core

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL. Must match what you register as webhook and OAuth callback URLs. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser-safe key. Auth and all RLS-enforced reads use it. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Bypasses RLS. Server-only — never expose it. |
| `APP_ENCRYPTION_KEY` | yes | Encrypts stored platform tokens. `openssl rand -hex 32`. |
| `SESSION_SECRET` | no | Reserved. Not yet read by anything. |

> **Back up `APP_ENCRYPTION_KEY`.** Lose it and every stored channel token is unrecoverable — you would have to reconnect every channel.

### Meta — Messenger, Instagram, WhatsApp

One Meta app covers all three.

| Variable | Required | Purpose |
| --- | --- | --- |
| `META_APP_ID` | for OAuth connect | Meta app id. |
| `META_APP_SECRET` | yes, for any Meta channel | Signs every webhook. **Without it all Meta webhooks are rejected.** |
| `META_VERIFY_TOKEN` | yes | Any string you choose; paste the same value into Meta's webhook dialog. |
| `META_GRAPH_API_VERSION` | recommended | Defaults to `v26.0`, the newest version `graph.facebook.com` recognizes. |
| `META_PAGE_ACCESS_TOKEN` | fallback | Used only when a channel row has no usable stored token. |
| `INSTAGRAM_PAGE_ACCESS_TOKEN` | fallback | Falls back to `META_PAGE_ACCESS_TOKEN`. |
| `WHATSAPP_ACCESS_TOKEN` | fallback | As above, for WhatsApp. |
| `WHATSAPP_PHONE_NUMBER_ID` | fallback | The phone number **id**, not the number. |
| `WHATSAPP_VERIFY_TOKEN` | no | Separate WhatsApp verify token; falls back to `META_VERIFY_TOKEN`. |

### LINE

| Variable | Required | Purpose |
| --- | --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | fallback | Messaging API token. |
| `LINE_CHANNEL_SECRET` | yes, for LINE | Validates `X-Line-Signature`. **Without it all LINE webhooks are rejected.** |

**On "fallback":** tokens normally live encrypted in `channels.access_token_encrypted` and are set by connecting a channel in the UI. The env vars are a single-account convenience for local development; a stored token always wins.

---

## Database setup

Run these in the Supabase SQL editor, in order:

1. **`supabase/schema.sql`** — tables and indexes.
2. **`supabase/rls.sql`** — row-level security, helper functions, column grants.
3. `supabase/seed.sql` — optional, only if you want to insert a channel by hand.

Both are idempotent, so re-run them after pulling changes. Order matters: `rls.sql` references the `org_invites` table that `schema.sql` creates.

You do **not** need to seed an organization or an admin — `/signup` creates both.

### What the schema adds beyond the spec

- `conversations.last_inbound_at` — anchors the WhatsApp 24-hour window.
- `org_invites` — pending invitations with single-use tokens.
- Unique index on `channels(platform, external_account_id)` — webhook routing depends on this pair being unique.
- Unique index on `messages.platform_message_id` — platforms redeliver until they get a 200, and without this every retry would duplicate a message.
- Unique index on `org_users(auth_user_id)` — one membership per person.

### Two RLS bugs the spec's policies contained

Worth knowing if you are adapting `rls.sql`:

1. **Infinite recursion.** `current_org_id()` reads `org_users`, and the policy on `org_users` calls it — so the lookup was subject to the policy that invoked it. Postgres aborts with *infinite recursion detected in policy for relation org_users*. The helpers now run as `SECURITY DEFINER` with a pinned `search_path`.

2. **`FOR ALL` silently granted `SELECT`.** Permissive policies are OR'd together, so `"admins and agents can manage conversations" FOR ALL` gave every agent read access to *every* conversation in the org — making the carefully written visibility rule directly above it dead code. Reads and writes are now separate policies.

---

## Connecting channels

`/admin/channels`, admins only. Two paths.

### Connect with Meta (recommended)

One Facebook login covers Messenger, Instagram, and WhatsApp.

First, add this to **Valid OAuth Redirect URIs** in your Meta app dashboard:

```
<NEXT_PUBLIC_APP_URL>/admin/channels/connect/meta/callback
```

Then press **Connect with Meta**. What happens:

1. A CSRF `state` cookie is set and you are redirected to Facebook's login dialog.
2. The callback verifies `state` with a constant-time compare, exchanges the code, and **upgrades the result to a long-lived token** — a short-lived one expires in about an hour and would take every stored Page token down with it. It is parked in an encrypted, httpOnly cookie for 15 minutes.
3. You pick which Pages, Instagram accounts, and WhatsApp numbers to attach. Assets are re-fetched server-side on submit rather than trusted from the form, so a client cannot post an account it was never authorized for.
4. Each connected Page is subscribed to `messages`, `messaging_postbacks`, `message_deliveries`, and `message_reads`.

Discovery is failure-tolerant per product: an app without WhatsApp permissions still lists and connects its Pages, and the reason the other product failed is shown as a warning.

### Connect manually

For LINE (which has no OAuth) and for Meta accounts where you would rather paste a System User token. The form relabels itself per platform, because each one wants a different id and getting it wrong is the usual setup mistake:

| Platform | What goes in "account id" | Where to find it |
| --- | --- | --- |
| Messenger | Facebook Page id | Meta dashboard → your Page → About |
| Instagram | IG Business account id — **not** the @handle | Linked to your Page |
| WhatsApp | Phone number **id** — not the phone number | WhatsApp → API Setup |
| LINE | Bot user id | `GET https://api.line.me/v2/bot/info` → `userId` |

That LINE bot user id is what arrives as `destination` on every LINE webhook, which is how messages get routed to the right channel.

**The token is verified against the live platform before it is stored.** Saving an unusable credential would leave a channel that looks connected and silently drops every reply.

### Managing a channel

- **Test** — re-verifies the stored credential and writes the result back to `status`, so the list reflects reality rather than a stale `active` from whenever it was first connected.
- **Rename** — cosmetic; never touches the stored token.
- **Disconnect** — sets `status = disconnected`, keeps all history.
- **Delete** — removes the row. `conversations` and `messages` cascade from it, so the UI confirms first.

Reconnecting an account that already exists updates the row in place instead of failing the unique index, so an expired token can be swapped without losing conversations.

---

## Receiving messages: webhooks

```
/api/webhooks/messenger
/api/webhooks/instagram
/api/webhooks/whatsapp
/api/webhooks/line
```

Register `<NEXT_PUBLIC_APP_URL>/api/webhooks/<platform>` in each platform's dashboard. For Meta, also enter your `META_VERIFY_TOKEN` when prompted.

### Local development

Platforms need a public HTTPS URL. Use a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

Then set `NEXT_PUBLIC_APP_URL` to the tunnel URL, restart the dev server, and register that URL. It changes each time the tunnel restarts unless you have a reserved one.

### What each webhook does

1. Verifies the signature against the **raw request body**.
2. Normalizes the payload into messages and delivery receipts.
3. Resolves the `channels` row by the platform's own account id — Page id, WhatsApp `phone_number_id`, LINE `destination` — so two accounts on the same platform never collide.
4. Skips any message whose `platform_message_id` is already stored.
5. Upserts the conversation and inserts the message.
6. Applies delivery/read receipts to previously sent messages.
7. Emits Socket.io events to the org and conversation rooms.
8. Returns 200 immediately. Contact profile lookups run detached, because a slow enrichment call must never delay the acknowledgement.

**Signature verification is mandatory.** If `META_APP_SECRET` or `LINE_CHANNEL_SECRET` is unset, that webhook rejects everything rather than accepting unsigned payloads — an unsigned webhook endpoint lets anyone inject messages into your inbox.

Messenger and Instagram echo events (`message.is_echo`) are dropped: they are your own outbound replies coming back, and ingesting them would duplicate every agent reply as a customer message.

### WhatsApp Cloud API quick start

1. In the Meta dashboard, add **WhatsApp** to your app and open **WhatsApp → API Setup**.
2. Connect the number in Unibox (OAuth, or manually with the phone number id and token).
3. Set the callback to `<NEXT_PUBLIC_APP_URL>/api/webhooks/whatsapp` with your verify token, and subscribe to the `messages` field.
4. Add your own number as a test recipient, then message the test sender number.

Tokens from API Setup are temporary and **expire after 24 hours**. Use a System User token (Business Settings → System Users) for anything longer than a test session.

---

## Sending messages

The composer posts to `/api/send-message`, which:

1. Requires a signed-in user whose role can reply.
2. Loads the conversation **through the caller's own client**, so RLS decides what they can see — an agent who is not assigned the thread gets a 404, not a reply.
3. Enforces the WhatsApp 24-hour window (409 if closed).
4. Decrypts the channel token and sends through the platform adapter.
5. **Only then** writes the message row. If the platform rejects it, nothing is stored and the error is returned — a bubble that looks delivered for a message the customer never got is worse than an error.
6. Emits the live update.

`sender_id` comes from the session, never the request body, so a caller cannot attribute a message to another agent.

---

## Security model

Three independent layers, so a bug in one does not open the app:

1. **Middleware** (`middleware.ts`) refreshes the session and blocks anonymous requests. Pages get redirected to `/login?next=…`; `/api/*` gets a JSON 401. Webhook and health routes are excluded — a platform callback has no session, and gating it would reject every real delivery.
2. **Page and action guards** (`lib/auth.ts`) re-check the role server-side. Server actions are public HTTP endpoints, so each one calls `requireRole` itself rather than trusting the page that rendered its form.
3. **Postgres RLS** is the backstop. Everything a person triggers queries through a client carrying their JWT, so the policies actually run.

**Column privileges do what RLS cannot.** `channels.access_token_encrypted` and `webhook_secret` are revoked from the `authenticated` role outright. RLS filters rows, not columns — without the revoke, any org member could read the platform tokens on a channel row already visible to them.

**The service role key is used in exactly four places**, each documented at the call site: webhook ingestion, signup (the org must exist before you can be a member of it), invite acceptance (the invitee is not a member yet), and decrypting channel credentials to send.

**Socket rooms are server-assigned.** The client sends its access token in the handshake and the server derives the room from it — a client cannot ask to join another workspace's room.

**Other properties:** `?next=` is validated as a relative path so it cannot become an open redirect; invite tokens are 256-bit, single-use, and expire in 7 days; OAuth state is compared in constant time; platform tokens are AES-256-GCM encrypted before reaching Postgres.

---

## Troubleshooting

**"Supabase is not configured" on startup, but my env vars are set.**
Restart the server. `.env.local` is read at startup, and `pnpm dev` loads it during Next's prepare step.

**Inbox is empty and the log says `column conversations.last_inbound_at does not exist`.**
Run `supabase/schema.sql`. When Supabase is configured but a query fails, the app returns empty results and logs the cause rather than substituting demo rows — a silent fallback makes a broken query look like an empty inbox.

**Channel says connected, but no messages arrive.**
Almost always the webhook. Check the URL is registered and reachable, the verify token matches, and — for Messenger — that the Page is subscribed (reconnecting via OAuth does this for you). A `401 Invalid webhook signature` in the logs means `META_APP_SECRET` or `LINE_CHANNEL_SECRET` is wrong or unset.

**Replies fail with "Session has expired".**
The Meta token expired. Temporary API Setup tokens last 24 hours; OAuth user tokens about 60 days. Reconnect the channel, or press **Test** to confirm.

**The socket pill says offline.**
In a Supabase-configured deployment the handshake requires a valid access token. Confirm you are signed in; the app still works, you just need to refresh for new messages.

**`Unknown path components: /me` from the Graph API.**
`META_GRAPH_API_VERSION` is set past what Meta recognizes. `v26.0` is the current maximum; anything higher is parsed as part of the path.

---

## Limitations

- **Invites are not emailed** — the admin copies a `/join/<token>` link.
- **Assignment, closing, and note creation are read-only in the UI.** The data model and store functions exist; the buttons are not wired.
- **WhatsApp sends text only.** Template messages (needed outside the 24-hour window) and outbound media are not implemented.
- **WhatsApp channels connected via OAuth store the long-lived user token**, which expires in ~60 days. A System User token via manual connect does not rotate.
- **LINE verification uses a single `LINE_CHANNEL_SECRET`**, so one LINE channel per deployment. Meta platforms sign with one app secret and already support multiple accounts.
- **One workspace per account.** Accepting an invite while already a member of another org is rejected rather than supported.
- **Meta App Review** is required for `pages_messaging` and friends before the connect flow works for accounts outside your app's development roles.
- **No audit log** on destructive admin actions.
- **WeChat is out of scope** — see the note at the end of `docs/base.md`.

---

## Roadmap

1. Send invite emails instead of surfacing a copyable link.
2. Wire assignment, close/reopen, and note creation in the inbox.
3. WhatsApp template and media sends.
4. Per-channel LINE secrets so one deployment can serve several LINE accounts.
5. Response-time analytics — needs a first-response timestamp per conversation, which the schema does not record yet.
6. Audit logging for admin actions.

---

## Production notes

- Keep the service role key server-only, and back up `APP_ENCRYPTION_KEY`.
- Never deploy without Supabase env vars set — that silently enables demo mode, which has no auth.
- Prefer System User tokens over the temporary ones from API Setup.
- Keep `META_GRAPH_API_VERSION` current; Meta retires versions on a schedule.
- Rotate `APP_ENCRYPTION_KEY` by re-encrypting `channels.access_token_encrypted` — there is no migration helper for this yet.
