-- Realtime delivery for the messages table requires FULL replica identity.
-- Without it, INSERT events can stream out missing task_id — the chat-list
-- reorder subscription silently drops every message.
alter table public.messages replica identity full;
