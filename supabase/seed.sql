-- Minimal starter seed for a single-org setup.
-- Replace `<your-auth-user-id>` with the UUID from Supabase Auth for the account
-- you want to make an admin.

insert into organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Unibox Demo Org')
on conflict (id) do nothing;

insert into org_users (id, org_id, auth_user_id, role, display_name)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '<your-auth-user-id>',
  'admin',
  'Your Name'
)
on conflict (id) do nothing;

insert into channels (
  id,
  org_id,
  platform,
  display_name,
  external_account_id,
  access_token_encrypted,
  webhook_secret,
  status,
  connected_by
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'messenger',
  'Starter Messenger Channel',
  'page_123456',
  'replace-with-encrypted-token',
  'replace-with-webhook-secret',
  'active',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;
