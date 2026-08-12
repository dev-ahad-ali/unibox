-- Row-Level Security for Unibox.
--
-- Re-runnable: every policy is dropped before it is created.
--
-- These policies only do anything when queries run as the signed-in user
-- (anon key + user JWT). The service role key bypasses RLS entirely and is
-- reserved for webhook ingestion and the signup/invite paths.

alter table organizations enable row level security;
alter table org_users enable row level security;
alter table channels enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table internal_notes enable row level security;
alter table org_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required, not optional. These read org_users, and the
-- policy on org_users calls them — without DEFINER the lookup is itself subject
-- to that policy and Postgres aborts with "infinite recursion detected in
-- policy for relation org_users".
-- The empty search_path stops a caller-controlled path from resolving these
-- names to a different table.

create or replace function current_org_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from org_users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id
  from org_users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function current_org_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from org_users
  where auth_user_id = auth.uid()
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Column privileges
-- ---------------------------------------------------------------------------
-- RLS filters rows, never columns. Without these grants any org member could
-- select channels.access_token_encrypted, because the row itself is visible to
-- them. Granting column-by-column is what actually keeps platform credentials
-- away from agents.

revoke all on channels from anon, authenticated;
grant select (
  id, org_id, platform, display_name, external_account_id, status, connected_by, created_at
) on channels to authenticated;
grant insert (
  id, org_id, platform, display_name, external_account_id, status, connected_by
) on channels to authenticated;
grant update (
  display_name, external_account_id, status
) on channels to authenticated;
grant delete on channels to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
drop policy if exists "org members can read organizations" on organizations;
create policy "org members can read organizations"
on organizations
for select
to authenticated
using (id = current_org_id());

-- ---------------------------------------------------------------------------
-- org_users
-- ---------------------------------------------------------------------------
drop policy if exists "org members can read their membership row" on org_users;
create policy "org members can read their membership row"
on org_users
for select
to authenticated
using (org_id = current_org_id());

drop policy if exists "admins can manage membership" on org_users;
-- Split from FOR ALL: a FOR ALL policy also grants SELECT, and permissive
-- policies are OR'd together, so it would silently widen read access.
create policy "admins can add membership"
on org_users
for insert
to authenticated
with check (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can update membership" on org_users;
create policy "admins can update membership"
on org_users
for update
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id())
with check (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can remove membership" on org_users;
create policy "admins can remove membership"
on org_users
for delete
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------
drop policy if exists "org members can read channels" on channels;
create policy "org members can read channels"
on channels
for select
to authenticated
using (org_id = current_org_id());

drop policy if exists "admins can manage channels" on channels;
create policy "admins can add channels"
on channels
for insert
to authenticated
with check (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can update channels" on channels;
create policy "admins can update channels"
on channels
for update
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id())
with check (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can delete channels" on channels;
create policy "admins can delete channels"
on channels
for delete
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
drop policy if exists "members can read conversations" on conversations;
create policy "members can read conversations"
on conversations
for select
to authenticated
using (
  org_id = current_org_id()
  and (
    current_org_role() in ('admin', 'viewer')
    or assigned_agent_id = current_org_user_id()
    or (assigned_agent_id is null and status = 'open')
  )
);

-- The previous version of this file used FOR ALL here. Because permissive
-- policies OR together, that handed agents SELECT on every conversation in the
-- org and made the visibility rule above dead code. Writes are split out.
drop policy if exists "admins and agents can manage conversations" on conversations;
create policy "admins and agents can create conversations"
on conversations
for insert
to authenticated
with check (current_org_role() in ('admin', 'agent') and org_id = current_org_id());

drop policy if exists "admins and agents can update conversations" on conversations;
create policy "admins and agents can update conversations"
on conversations
for update
to authenticated
using (
  org_id = current_org_id()
  and (
    current_org_role() = 'admin'
    or (
      current_org_role() = 'agent'
      and (assigned_agent_id = current_org_user_id() or assigned_agent_id is null)
    )
  )
)
with check (org_id = current_org_id());

drop policy if exists "admins can delete conversations" on conversations;
create policy "admins can delete conversations"
on conversations
for delete
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
drop policy if exists "members can read messages through visible conversations" on messages;
create policy "members can read messages through visible conversations"
on messages
for select
to authenticated
using (
  exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
      and (
        current_org_role() in ('admin', 'viewer')
        or c.assigned_agent_id = current_org_user_id()
        or (c.assigned_agent_id is null and c.status = 'open')
      )
  )
);

drop policy if exists "admins and agents can write messages" on messages;
create policy "admins and agents can write messages"
on messages
for insert
to authenticated
with check (
  current_org_role() in ('admin', 'agent')
  and exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
  )
);

-- ---------------------------------------------------------------------------
-- internal_notes
-- ---------------------------------------------------------------------------
drop policy if exists "members can read notes" on internal_notes;
create policy "members can read notes"
on internal_notes
for select
to authenticated
using (
  exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
  )
);

drop policy if exists "admins and agents can write notes" on internal_notes;
create policy "admins and agents can write notes"
on internal_notes
for insert
to authenticated
with check (
  current_org_role() in ('admin', 'agent')
  and exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
  )
);

-- ---------------------------------------------------------------------------
-- org_invites
-- ---------------------------------------------------------------------------
-- Only admins can see who has been invited. Accepting an invite happens on the
-- service client, because the invitee is by definition not a member yet — the
-- unguessable token is the credential there.
drop policy if exists "admins can read invites" on org_invites;
create policy "admins can read invites"
on org_invites
for select
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can manage invites" on org_invites;
create policy "admins can create invites"
on org_invites
for insert
to authenticated
with check (current_org_role() = 'admin' and org_id = current_org_id());

drop policy if exists "admins can delete invites" on org_invites;
create policy "admins can delete invites"
on org_invites
for delete
to authenticated
using (current_org_role() = 'admin' and org_id = current_org_id());
