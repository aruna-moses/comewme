-- Fan out one notification per participant (host + accepted joiners) when an
-- activity is marked completed. Existing DB webhook turns the notifications
-- rows into FCM pushes for anyone not in the app right now, and an in-app
-- toast/feed item for anyone who is.

create or replace function public.notify_participants_on_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    v_title := left(coalesce(new.title, 'Your activity'), 80);
    v_body  := '"' || v_title || '" — you pulled it off together. Tap to see.';

    -- the host too, they showed up and did the work
    insert into public.notifications (user_id, type, title, body, link_path)
    values (new.host_id, 'info', 'Activity complete', v_body, '/task/' || new.id);

    -- everyone who was accepted into the group
    insert into public.notifications (user_id, type, title, body, link_path)
    select j.requester_id, 'info', 'Activity complete', v_body, '/task/' || new.id
      from public.join_requests j
     where j.task_id = new.id
       and j.status = 'accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_participants_on_task_completed on public.tasks;
create trigger trg_notify_participants_on_task_completed
after update of status on public.tasks
for each row execute function public.notify_participants_on_task_completed();
