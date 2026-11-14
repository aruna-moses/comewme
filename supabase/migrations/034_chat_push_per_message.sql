-- Drop the dedup behaviour in favour of one notification per message,
-- so every message triggers the webhook -> push.
-- Run in Supabase SQL Editor -> New query -> Run

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.user_id,
    'chat',
    coalesce(new.sender_name, 'Someone') || ' sent a message',
    left(coalesce(nullif(new.body, ''), '[media]'), 160),
    '/task/' || new.task_id || '/chat'
  from (
    select requester_id as user_id
      from public.join_requests
      where task_id = new.task_id and status = 'accepted'
    union
    select host_id from public.tasks where id = new.task_id
  ) p
  where p.user_id <> new.sender_id;

  return new;
end;
$$;
