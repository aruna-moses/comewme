-- ============================================================
-- Come w' me — chat media migration (v2)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- 1) Extend messages with media fields
alter table public.messages
  add column if not exists type text default 'text' check (type in ('text','image','audio'));

alter table public.messages
  add column if not exists url text;

alter table public.messages
  add column if not exists duration int; -- seconds, for audio

-- 2) Private storage bucket for chat media (images & voice notes)
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- 3) Storage policies
--    NOTE: message rows are already RLS-protected to participants only,
--    so an outsider can't discover a media URL anyway. This storage policy
--    lets participants fetch the file once they have the message row.
drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media');

drop policy if exists chat_media_select on storage.objects;
create policy chat_media_select on storage.objects
  for select using (bucket_id = 'chat-media');

-- 4) Index for fetching a task's media messages
create index if not exists messages_task_type_idx
  on public.messages (task_id, type, created_at);
