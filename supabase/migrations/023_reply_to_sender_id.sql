-- ============================================================
-- Come w' me — Sender-id for reply previews (v023)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

alter table public.messages
  add column if not exists reply_to_sender_id uuid references public.profiles(id) on delete set null;

-- Backfill: if anyone already replies to a message by someone in the same chat,
-- we can pair it by sender_name match — sender_name equals display_name at send time.
update public.messages m
set reply_to_sender_id = q.sender_id
from public.messages q
where m.reply_to_message_id = q.id
  and m.reply_to_sender_id is null;
