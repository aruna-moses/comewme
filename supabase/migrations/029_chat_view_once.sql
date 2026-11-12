-- ============================================================
-- Come w' me — View-once chat media (v029)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to re-run.
-- ============================================================

-- 1. Flag the message as view-once.
alter table public.messages
  add column if not exists view_once boolean not null default false;

-- 2. One row per viewer who has opened the media.
create table if not exists public.message_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_views enable row level security;

-- Readers can see their own view rows. Senders can see who opened their media,
-- and hosts can see rows for activities they run (useful for moderation).
drop policy if exists message_views_select on public.message_views;
create policy message_views_select on public.message_views
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.messages m
      where m.id = message_views.message_id
        and m.sender_id = auth.uid()
    )
    or exists (
      select 1
      from public.messages m
      join public.tasks t on t.id = m.task_id
      where m.id = message_views.message_id
        and t.host_id = auth.uid()
    )
  );

-- A member can record their own view, only for a view-once message they did
-- not send, inside a room they belong to.
drop policy if exists message_views_insert_self on public.message_views;
create policy message_views_insert_self on public.message_views
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      where m.id = message_views.message_id
        and m.view_once = true
        and m.sender_id <> auth.uid()
        and (
          exists (
            select 1 from public.tasks t
            where t.id = m.task_id and t.host_id = auth.uid()
          )
          or exists (
            select 1 from public.join_requests j
            where j.task_id = m.task_id
              and j.requester_id = auth.uid()
              and j.status = 'accepted'
          )
        )
    )
  );

create index if not exists message_views_message_idx
  on public.message_views (message_id);
