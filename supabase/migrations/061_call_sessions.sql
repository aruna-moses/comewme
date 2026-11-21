-- ============================================================
-- Come w' me — 1:1 / group call signaling (v061)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
-- Rooms and tokens are created by the create-daily-room Edge Function;
-- this table only signals who is calling whom, so existing chat code is
-- untouched.
-- ============================================================

-- allow the new notification kind used for incoming call pushes.
-- Build the allow-list from every type already in the table (older builds may
-- have used types no longer in the repo) plus the types the app still writes.
do $$
declare
  v_types text;
begin
  select string_agg(quote_literal(kind), ',' order by kind)
    into v_types
  from (
    select unnest(array[
      'join_request','selfie','appeal','violation','chat','info','reminder','incoming_call'
    ]) as kind
    union
    select distinct type from public.notifications
  ) all_types;

  alter table public.notifications drop constraint if exists notifications_type_check;
  execute format(
    'alter table public.notifications add constraint notifications_type_check check (type in (%s))',
    v_types
  );
end $$;

create table if not exists public.call_sessions (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.tasks(id) on delete cascade,
  caller_id   uuid not null references auth.users(id) on delete cascade,
  call_type   text not null check (call_type in ('audio', 'video')),
  room_url    text not null,
  -- short-lived Daily meeting token (1h) shared with members of this activity
  room_token  text not null default '',
  status      text not null default 'ringing'
              check (status in ('ringing', 'active', 'ended', 'missed')),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create index if not exists call_sessions_chat_status_idx
  on public.call_sessions (chat_id, status, created_at desc);

alter table public.call_sessions enable row level security;

drop policy if exists call_sessions_select_member on public.call_sessions;
create policy call_sessions_select_member on public.call_sessions
  for select to authenticated
  using (
    caller_id = auth.uid()
    or public.is_task_participant(chat_id)
  );

drop policy if exists call_sessions_insert_caller on public.call_sessions;
create policy call_sessions_insert_caller on public.call_sessions
  for insert to authenticated
  with check (
    caller_id = auth.uid()
    and public.is_task_participant(chat_id)
  );

drop policy if exists call_sessions_update_member on public.call_sessions;
create policy call_sessions_update_member on public.call_sessions
  for update to authenticated
  using (public.is_task_participant(chat_id))
  with check (public.is_task_participant(chat_id));

grant select, insert, update on public.call_sessions to authenticated;

-- realtime delivery of incoming calls; RLS applies to the stream
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'call_sessions'
    ) then
      alter publication supabase_realtime add table public.call_sessions;
    end if;
  end if;
end $$;
