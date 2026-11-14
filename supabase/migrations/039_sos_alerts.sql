-- ============================================================
-- Come w' me — SOS alerts (v5)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.sos_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  media_url    text,
  media_type   text check (media_type in ('image', 'video')),
  status       text not null default 'pending'
               check (status in ('pending','reviewed','resolved','false_alarm')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id),
  admin_note   text
);

alter table public.sos_alerts enable row level security;

-- Users can insert their own SOS alerts
create policy sos_insert_own on public.sos_alerts
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Users can read their own SOS alerts
create policy sos_read_own on public.sos_alerts
  for select using (auth.uid() = user_id);

-- Service role (admin) can read all — no policy needed for service role,
-- but we add a select policy for clarity if using anon key with admin context.
-- Service role bypasses RLS anyway.

create index if not exists sos_alerts_user_id_idx on public.sos_alerts(user_id);
create index if not exists sos_alerts_task_id_idx on public.sos_alerts(task_id);
create index if not exists sos_alerts_created_at_idx on public.sos_alerts(created_at desc);

-- Ensure chat-media bucket exists for SOS media uploads
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

create policy sos_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media');

create policy sos_media_select on storage.objects
  for select using (bucket_id = 'chat-media');
