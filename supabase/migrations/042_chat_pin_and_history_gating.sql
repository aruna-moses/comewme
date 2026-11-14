-- 037_chat_pin_and_history_gating.sql
-- Hosts can pin one message to the top of the group chat, and members who
-- join later can no longer read the history from before they were accepted.

-- ------------------------------------------------------------------
-- 1) Stamp the exact moment a join request is accepted.
-- ------------------------------------------------------------------
alter table public.join_requests
  add column if not exists accepted_at timestamptz;

update public.join_requests
   set accepted_at = created_at
 where status = 'accepted'
   and accepted_at is null;

create or replace function public.stamp_join_accepted_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and coalesce(old.status::text, '') <> 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_join_accepted_at on public.join_requests;
create trigger trg_stamp_join_accepted_at
  before update of status on public.join_requests
  for each row execute function public.stamp_join_accepted_at();

-- ------------------------------------------------------------------
-- 2) History gate: host sees everything; accepted members see only from
--    the moment they were accepted onward.
-- ------------------------------------------------------------------
drop policy if exists messages_read_participants on public.messages;
create policy messages_read_participants on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = messages.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = messages.task_id
        and j.requester_id = auth.uid()
        and j.status = 'accepted'
        and messages.created_at >= coalesce(j.accepted_at, j.created_at)
    )
  );

drop policy if exists activity_events_read on public.activity_system_events;
create policy activity_events_read on public.activity_system_events
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_system_events.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = activity_system_events.task_id
        and j.requester_id = auth.uid()
        and j.status = 'accepted'
        and activity_system_events.created_at >= coalesce(j.accepted_at, j.created_at)
    )
  );

drop policy if exists activity_checkins_read on public.activity_checkins;
create policy activity_checkins_read on public.activity_checkins
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_checkins.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = activity_checkins.task_id
        and j.requester_id = auth.uid()
        and j.status = 'accepted'
        and activity_checkins.checked_in_at >= coalesce(j.accepted_at, j.created_at)
    )
  );

-- Recaps leaked to any authenticated user (using true). Gate them to gated members.
drop policy if exists activity_recaps_read on public.activity_recaps;
create policy activity_recaps_read on public.activity_recaps
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_recaps.task_id and t.host_id = auth.uid()
    )
    or exists (
      select 1 from public.join_requests j
      where j.task_id = activity_recaps.task_id
        and j.requester_id = auth.uid()
        and j.status = 'accepted'
        and activity_recaps.created_at >= coalesce(j.accepted_at, j.created_at)
    )
  );

-- ------------------------------------------------------------------
-- 3) Pinned message: one per activity, host-only write, WhatsApp-style.
-- ------------------------------------------------------------------
create table if not exists public.activity_pinned_messages (
  task_id    uuid primary key references public.tasks(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by  uuid not null references public.profiles(id) on delete cascade,
  pinned_at  timestamptz not null default now()
);

alter table public.activity_pinned_messages enable row level security;

drop policy if exists pinned_read on public.activity_pinned_messages;
create policy pinned_read on public.activity_pinned_messages
  for select to authenticated
  using (public.is_task_participant(task_id));

drop policy if exists pinned_host_write on public.activity_pinned_messages;
create policy pinned_host_write on public.activity_pinned_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = activity_pinned_messages.task_id and t.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = activity_pinned_messages.task_id and t.host_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'activity_pinned_messages'
  ) then
    alter publication supabase_realtime add table public.activity_pinned_messages;
  end if;
end $$;
