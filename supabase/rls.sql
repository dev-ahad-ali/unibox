alter table organizations enable row level security;
alter table org_users enable row level security;
alter table channels enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table internal_notes enable row level security;

create or replace function current_org_user_id()
returns uuid
language sql
stable
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
as $$
  select role
  from org_users
  where auth_user_id = auth.uid()
  limit 1
$$;

create policy "org members can read organizations"
on organizations
for select
using (
  id = current_org_id()
);

create policy "org members can read their membership row"
on org_users
for select
using (
  org_id = current_org_id()
);

create policy "admins can manage membership"
on org_users
for all
using (
  current_org_role() = 'admin' and org_id = current_org_id()
)
with check (
  current_org_role() = 'admin' and org_id = current_org_id()
);

create policy "org members can read channels"
on channels
for select
using (
  org_id = current_org_id()
);

create policy "admins can manage channels"
on channels
for all
using (
  current_org_role() = 'admin' and org_id = current_org_id()
)
with check (
  current_org_role() = 'admin' and org_id = current_org_id()
);

create policy "members can read conversations"
on conversations
for select
using (
  org_id = current_org_id()
  and (
    current_org_role() in ('admin', 'viewer')
    or assigned_agent_id = current_org_user_id()
    or (assigned_agent_id is null and status = 'open')
  )
);

create policy "admins and agents can manage conversations"
on conversations
for all
using (
  current_org_role() in ('admin', 'agent') and org_id = current_org_id()
)
with check (
  current_org_role() in ('admin', 'agent') and org_id = current_org_id()
);

create policy "members can read messages through visible conversations"
on messages
for select
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

create policy "admins and agents can write messages"
on messages
for insert
with check (
  exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
      and current_org_role() in ('admin', 'agent')
  )
);

create policy "members can read notes"
on internal_notes
for select
using (
  exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
  )
);

create policy "admins and agents can write notes"
on internal_notes
for insert
with check (
  exists (
    select 1
    from conversations c
    where c.id = conversation_id
      and c.org_id = current_org_id()
      and current_org_role() in ('admin', 'agent')
  )
);
