-- ============================================================
-- Come w' me — System events / check-ins / recaps (v028)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.activity_system_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  event_type  text not null check (event_type in ('joined','left','on_my_way','arrived','completed','recap')),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_name  text not null,
  body        text,
  created_at  timestamptz not null default now()
);

alter table public.activity_system_events enable row level security;

drop policy if exists activity_events_read on public.activity_system_events;
create policy activity_events_read on public.activity_system_events
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_system_events.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = activity_system_events.task_id and j.requester_id = auth.uid() and j.status = 'accepted'
    )
  );

-- Members can record their own check-ins.
drop policy if exists activity_events_insert_self on public.activity_system_events;
create policy activity_events_insert_self on public.activity_system_events
  for insert to authenticated
  with check (
    actor_id is null or auth.uid() = actor_id
  );

create index if not exists activity_events_task_idx on public.activity_system_events (task_id, created_at);

-- Activity check-ins: each member marked present.
create table if not exists public.activity_checkins (
  task_id       uuid not null references public.tasks(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.activity_checkins enable row level security;

drop policy if exists activity_checkins_read on public.activity_checkins;
create policy activity_checkins_read on public.activity_checkins
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_checkins.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = activity_checkins.task_id and j.requester_id = auth.uid() and j.status = 'accepted'
    )
  );

drop policy if exists activity_checkins_insert_self on public.activity_checkins;
create policy activity_checkins_insert_self on public.activity_checkins
  for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists activity_checkins_task_idx on public.activity_checkins (task_id);

-- A host writing the recap at the end of an activity. Anyone can read it. One per task.
create table if not exists public.activity_recaps (
  task_id     uuid primary key references public.tasks(id) on delete cascade,
  host_id     uuid not null references auth.users(id) on delete cascade,
  host_name   text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

alter table public.activity_recaps enable row level security;

drop policy if exists activity_recaps_read on public.activity_recaps;
create policy activity_recaps_read on public.activity_recaps
  for select to authenticated
  using (true);

drop policy if exists activity_recaps_insert_host on public.activity_recaps;
create policy activity_recaps_insert_host on public.activity_recaps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = activity_recaps.task_id and t.host_id = auth.uid()
    )
  );

drop policy if exists activity_recaps_update_host on public.activity_recaps;
create policy activity_recaps_update_host on public.activity_recaps
  for update to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_recaps.task_id and t.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = activity_recaps.task_id and t.host_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.activity_system_events;
alter publication supabase_realtime add table public.activity_checkins;

-- Automatic system events: place in DB so every host + member records the same history.
create or replace function public.record_join_system_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status = 'accepted' and coalesce(old.status::text, '') <> 'accepted' then
    v_name := coalesce(new.requester_name, 'Someone');
    insert into public.activity_system_events (task_id, event_type, actor_id, actor_name, body)
      values (new.task_id, 'joined', new.requester_id, v_name, null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_join_system_event on public.join_requests;
create trigger trg_join_system_event
after update on public.join_requests
for each row execute function public.record_join_system_event();

create or replace function public.record_complete_system_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and coalesce(old.status::text, '') <> 'completed' then
    insert into public.activity_system_events (task_id, event_type, actor_id, actor_name, body)
      values (new.id, 'completed', new.host_id, coalesce(new.host_name, 'Host'), null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complete_system_event on public.tasks;
create trigger trg_complete_system_event
after update on public.tasks
for each row execute function public.record_complete_system_event();
