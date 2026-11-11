-- ============================================================
-- Come w' me — Chat message push notifications (v022)
-- Run in Supabase SQL Editor -> New query -> Run
-- Depends on 021_notifications.sql
-- ============================================================

-- Allow the 'chat' notification type (021 ships without it)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('join_request','selfie','appeal','violation','chat','info','reminder'));

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Refresh an existing unread notification for this thread so it carries the newest message,
  -- rather than flooding the user with one per send.
  update public.notifications n
  set body = left(coalesce(nullif(new.body, ''), '[media]'), 160),
      created_at = now()
  where n.type = 'chat'
    and n.link_path = '/task/' || new.task_id || '/chat'
    and n.read_at is null
    and n.user_id in (
      select requester_id from public.join_requests
      where task_id = new.task_id and status = 'accepted'
      union
      select host_id from public.tasks where id = new.task_id
    )
    and n.user_id <> new.sender_id;

  -- Anyone who doesn't already have an unread one for this thread gets a fresh notification.
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.user_id,
    'chat',
    new.sender_name || ' sent a message',
    left(coalesce(nullif(new.body, ''), '[media]'), 160),
    '/task/' || new.task_id || '/chat'
  from (
    select requester_id as user_id
    from public.join_requests
    where task_id = new.task_id and status = 'accepted'
    union
    select host_id from public.tasks where id = new.task_id
  ) p
  where p.user_id <> new.sender_id
    and not exists (
      select 1 from public.notifications n2
      where n2.user_id = p.user_id
        and n2.type = 'chat'
        and n2.link_path = '/task/' || new.task_id || '/chat'
        and n2.read_at is null
    );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_chat_message on public.messages;
create trigger trg_notify_on_chat_message
after insert on public.messages
for each row execute function public.notify_on_chat_message();
