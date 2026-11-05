create table if not exists public.guideline_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guideline_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  unique (user_id, guideline_version)
);

create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete set null,
  reported_task_id uuid references public.tasks(id) on delete set null,
  category text not null check (category in (
    'harassment', 'no_show', 'fake_profile', 'scam', 'inappropriate',
    'spam', 'illegal_content', 'minor_safety', 'ban_evasion', 'other'
  )),
  severity text not null default 'warning' check (severity in (
    'warning', 'suspension_24h', 'suspension_7d', 'suspension_30d', 'permanent_ban'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'reviewed', 'resolved', 'appealed'
  )),
  description text not null check (char_length(description) between 3 and 4000),
  action_taken text,
  banned_until timestamptz,
  warning_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.violation_appeals (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null unique references public.violations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  appeal_reason text not null check (char_length(appeal_reason) between 3 and 4000),
  status text not null default 'pending' check (status in ('pending', 'granted', 'denied')),
  admin_response text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists violations_user_status_idx on public.violations (user_id, status);
create index if not exists violations_user_banned_until_idx
  on public.violations (user_id, banned_until) where banned_until is not null;
create index if not exists guideline_acceptances_user_idx on public.guideline_acceptances (user_id);
create index if not exists violation_appeals_violation_idx on public.violation_appeals (violation_id, created_at desc);
create index if not exists violations_pending_idx on public.violations (created_at desc) where status = 'pending';

alter table public.guideline_acceptances enable row level security;
alter table public.violations enable row level security;
alter table public.violation_appeals enable row level security;
alter table public.moderators enable row level security;

drop policy if exists guideline_acceptances_read_own on public.guideline_acceptances;
create policy guideline_acceptances_read_own on public.guideline_acceptances
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists guideline_acceptances_insert_own on public.guideline_acceptances;
create policy guideline_acceptances_insert_own on public.guideline_acceptances
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists violations_read_own on public.violations;
create policy violations_read_own on public.violations
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists violation_appeals_read_own on public.violation_appeals;
create policy violation_appeals_read_own on public.violation_appeals
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists violation_appeals_insert_own on public.violation_appeals;
create policy violation_appeals_insert_own on public.violation_appeals
  for insert to authenticated with check (
    auth.uid() = user_id
    and status = 'pending'
    and admin_response is null
    and reviewed_at is null
    and exists (
      select 1 from public.violations v
      where v.id = violation_id
        and v.user_id = auth.uid()
        and v.status in ('reviewed', 'appealed')
    )
  );

drop policy if exists moderators_read_own on public.moderators;
create policy moderators_read_own on public.moderators
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_moderator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;

create or replace function public.has_current_guidelines(p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.guideline_acceptances
    where user_id = p_user and guideline_version = '1.0'
  );
$$;

create or replace function public.has_active_suspension(p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.violations v
    where v.user_id = p_user
      and v.status in ('reviewed', 'appealed')
      and (
        v.severity = 'permanent_ban'
        or (
          v.severity in ('suspension_24h', 'suspension_7d', 'suspension_30d')
          and v.banned_until > now()
        )
      )
  );
$$;

create or replace function public.has_unacknowledged_warning(p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.violations v
    where v.user_id = p_user
      and v.severity = 'warning'
      and v.status in ('reviewed', 'appealed')
      and not v.warning_acknowledged
  );
$$;

create or replace function public.can_use_community(p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_user is not null
    and public.has_current_guidelines(p_user)
    and not public.has_active_suspension(p_user)
    and not public.has_unacknowledged_warning(p_user);
$$;

drop policy if exists join_update on public.join_requests;
create policy join_update on public.join_requests
  for update using (
    auth.uid() = requester_id
    or exists (select 1 from public.tasks t where t.id = task_id and t.host_id = auth.uid())
  )
  with check (
    (auth.uid() = requester_id and (status = 'withdrawn' or public.can_use_community(auth.uid())))
    or exists (select 1 from public.tasks t where t.id = task_id and t.host_id = auth.uid())
  );

drop policy if exists violations_insert_report on public.violations;
create policy violations_insert_report on public.violations
  for insert to authenticated with check (
    auth.uid() = reported_by
    and auth.uid() <> user_id
    and public.can_use_community(auth.uid())
    and status = 'pending'
    and severity = 'warning'
    and action_taken is null
    and banned_until is null
    and warning_acknowledged = false
    and reviewed_at is null
    and reviewed_by is null
    and (
      reported_task_id is null
      or exists (
        select 1 from public.tasks t
        where t.id = reported_task_id and t.host_id = user_id
      )
    )
  );

create or replace function public.accept_guidelines(p_version text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_version is distinct from '1.0' then
    raise exception 'Unsupported guideline acceptance';
  end if;

  insert into public.guideline_acceptances (user_id, guideline_version, user_agent)
  values (auth.uid(), p_version, left(p_user_agent, 500))
  on conflict (user_id, guideline_version) do nothing;
end;
$$;

create or replace function public.acknowledge_violation_warning(p_violation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.violations
  set warning_acknowledged = true
  where id = p_violation_id
    and user_id = auth.uid()
    and severity = 'warning'
    and status in ('reviewed', 'appealed')
    and warning_acknowledged = false;

  if not found then
    raise exception 'This warning is no longer available to acknowledge';
  end if;
end;
$$;

create or replace function public.mark_violation_appealed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.violations
  set status = 'appealed'
  where id = new.violation_id and status = 'reviewed';
  return new;
end;
$$;

drop trigger if exists trg_mark_violation_appealed on public.violation_appeals;
create trigger trg_mark_violation_appealed
after insert on public.violation_appeals
for each row execute function public.mark_violation_appealed();

create or replace function public.list_pending_reports()
returns setof public.violations
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  return query
    select * from public.violations
    where status = 'pending'
    order by created_at asc;
end;
$$;

create or replace function public.list_pending_violation_appeals()
returns table (
  id uuid,
  violation_id uuid,
  user_id uuid,
  appeal_reason text,
  created_at timestamptz,
  violation_category text,
  violation_description text,
  violation_severity text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  return query
    select a.id, a.violation_id, a.user_id, a.appeal_reason, a.created_at,
           v.category, v.description, v.severity
    from public.violation_appeals a
    join public.violations v on v.id = a.violation_id
    where a.status = 'pending'
    order by a.created_at asc;
end;
$$;

create or replace function public.review_violation(
  p_violation_id uuid,
  p_severity text,
  p_action_taken text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banned_until timestamptz;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_severity not in ('warning', 'suspension_24h', 'suspension_7d', 'suspension_30d', 'permanent_ban') then
    raise exception 'Invalid moderation action';
  end if;

  v_banned_until := case p_severity
    when 'suspension_24h' then now() + interval '24 hours'
    when 'suspension_7d' then now() + interval '7 days'
    when 'suspension_30d' then now() + interval '30 days'
    else null
  end;

  update public.violations
  set severity = p_severity,
      status = 'reviewed',
      action_taken = nullif(left(trim(p_action_taken), 1000), ''),
      banned_until = v_banned_until,
      warning_acknowledged = false,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_violation_id and status = 'pending';

  if not found then
    raise exception 'This report has already been reviewed';
  end if;
end;
$$;

create or replace function public.dismiss_violation(
  p_violation_id uuid,
  p_action_taken text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  update public.violations
  set status = 'resolved',
      action_taken = nullif(left(trim(p_action_taken), 1000), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_violation_id and status = 'pending';

  if not found then
    raise exception 'This report has already been reviewed';
  end if;
end;
$$;

create or replace function public.review_violation_appeal(
  p_appeal_id uuid,
  p_status text,
  p_admin_response text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_violation_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_status not in ('granted', 'denied') then
    raise exception 'Invalid appeal decision';
  end if;

  update public.violation_appeals
  set status = p_status,
      admin_response = nullif(left(trim(p_admin_response), 1000), ''),
      reviewed_at = now()
  where id = p_appeal_id and status = 'pending'
  returning violation_id into v_violation_id;

  if not found then
    raise exception 'This appeal has already been reviewed';
  end if;

  if p_status = 'granted' then
    update public.violations set status = 'resolved' where id = v_violation_id;
  else
    update public.violations set status = 'reviewed' where id = v_violation_id and status = 'appealed';
  end if;
end;
$$;

create or replace function public.accept_guidelines_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'guidelines_accepted_version' = '1.0' then
    insert into public.guideline_acceptances (user_id, guideline_version, user_agent)
    values (
      new.id,
      '1.0',
      left(new.raw_user_meta_data ->> 'guidelines_user_agent', 500)
    )
    on conflict (user_id, guideline_version) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_accept_guidelines on auth.users;
create trigger on_auth_user_created_accept_guidelines
after insert on auth.users
for each row execute function public.accept_guidelines_on_signup();

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert with check (
    auth.uid() = host_id
    and public.can_use_community(auth.uid())
    and not exists (
      select 1 from public.account_posting_controls controls
      where controls.user_id = auth.uid() and controls.suspended_at is not null
    )
  );

drop policy if exists join_insert_own on public.join_requests;
create policy join_insert_own on public.join_requests
  for insert with check (
    auth.uid() = requester_id
    and public.can_use_community(auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.status = 'open' and t.host_id <> auth.uid()
    )
  );

drop policy if exists messages_insert_participants on public.messages;
create policy messages_insert_participants on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_task_participant(task_id)
    and public.can_use_community(auth.uid())
  );

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.can_use_community(auth.uid())
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

grant execute on function public.is_moderator() to authenticated;
grant execute on function public.has_current_guidelines(uuid) to authenticated;
grant execute on function public.has_active_suspension(uuid) to authenticated;
grant execute on function public.has_unacknowledged_warning(uuid) to authenticated;
grant execute on function public.can_use_community(uuid) to authenticated;
grant execute on function public.accept_guidelines(text, text) to authenticated;
grant execute on function public.acknowledge_violation_warning(uuid) to authenticated;
grant execute on function public.list_pending_reports() to authenticated;
grant execute on function public.list_pending_violation_appeals() to authenticated;
grant execute on function public.review_violation(uuid, text, text) to authenticated;
grant execute on function public.dismiss_violation(uuid, text) to authenticated;
grant execute on function public.review_violation_appeal(uuid, text, text) to authenticated;

revoke all on function public.is_moderator() from public, anon;
revoke all on function public.has_current_guidelines(uuid) from public, anon;
revoke all on function public.has_active_suspension(uuid) from public, anon;
revoke all on function public.has_unacknowledged_warning(uuid) from public, anon;
revoke all on function public.can_use_community(uuid) from public, anon;
revoke all on function public.accept_guidelines(text, text) from public, anon;
revoke all on function public.acknowledge_violation_warning(uuid) from public, anon;
revoke all on function public.mark_violation_appealed() from public, anon;
revoke all on function public.list_pending_reports() from public, anon;
revoke all on function public.list_pending_violation_appeals() from public, anon;
revoke all on function public.review_violation(uuid, text, text) from public, anon;
revoke all on function public.dismiss_violation(uuid, text) from public, anon;
revoke all on function public.review_violation_appeal(uuid, text, text) from public, anon;
revoke all on function public.accept_guidelines_on_signup() from public, anon;

grant select, insert on public.violations to authenticated;
grant select, insert on public.violation_appeals to authenticated;
grant all on public.guideline_acceptances, public.violations, public.violation_appeals, public.moderators to service_role;

revoke all on public.moderators from anon, authenticated;
grant select on public.moderators to authenticated;
revoke insert, update, delete on public.guideline_acceptances from anon, authenticated;
grant select on public.guideline_acceptances to authenticated;
revoke update, delete on public.violations from anon, authenticated;
revoke update, delete on public.violation_appeals from anon, authenticated;
