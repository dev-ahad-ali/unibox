-- Optional starter data.
--
-- You no longer need to seed an organization or an admin by hand: signing up at
-- /signup creates the organization and makes you its first admin. This file is
-- only for attaching a channel to an org that already exists.
--
-- Find your org id first:
--   select id, name from organizations;
--
-- The access token must be encrypted with APP_ENCRYPTION_KEY before it is
-- stored. Generate the ciphertext with:
--
--   node -e "process.env.APP_ENCRYPTION_KEY='<your key>'; \
--     import('./lib/crypto.ts').then(m => console.log(m.encryptSecret('<token>')))"
--
-- Storing a raw token here will not work: decryptSecret() only accepts the
-- v1:iv:tag:ciphertext envelope and returns null for anything else, so the
-- adapter would silently fall back to the platform env var.

insert into channels (
  org_id,
  platform,
  display_name,
  external_account_id,
  access_token_encrypted,
  status
)
values (
  '<your-org-id>',
  'line',
  'Tokyo Support - LINE',
  -- For LINE this is the bot's own user id, which arrives as `destination` on
  -- every webhook. Read it from GET https://api.line.me/v2/bot/info.
  '<your-line-destination-id>',
  '<v1:...encrypted token...>',
  'active'
)
on conflict (platform, external_account_id) do nothing;
