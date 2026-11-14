-- ============================================================
-- Come w' me — Notifications carry the activity title (v035)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================
-- Chat notifications used to say "Aruna Moses sent a message" with no clue
-- which activity it belongs to. Now title = the activity, body = <sender>: <preview>.
-- Both in-app inbox and OS push preview get the context.

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  select title into v_title
  from public.tasks
  where id = new.task_id;

  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.user_id,
    'chat',
    left(coalesce(nullif(v_title, ''), 'Activity'), 60),
    coalesce(new.sender_name, 'Someone') || ': ' || left(coalesce(nullif(new.body, ''), '[media]'), 130),
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
