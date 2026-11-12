-- ============================================================
-- Come w' me — New application notification for hosts (v030)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================
-- Until now hosts only got a badge count; nobody told them a new
-- application had arrived. Insert a notification row for the host
-- (drives the bell, the inbox, and the live toast) when a request is
-- created. Re-applications after withdraw do not re-notify.

create or replace function public.notify_on_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_title   text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select host_id, title
    into v_host_id, v_title
  from public.tasks
  where id = new.task_id;

  if not found then
    return new;
  end if;

  perform public.push_notification(
    v_host_id,
    'join_request',
    'New application',
    coalesce(new.requester_name, 'Someone') || ' wants to join "' || coalesce(v_title, 'your activity') || '"',
    '/task/' || new.task_id
  );
  return new;
end $$;

drop trigger if exists trg_notify_join_request on public.join_requests;
create trigger trg_notify_join_request
after insert on public.join_requests
for each row execute function public.notify_on_join_request();

-- The task page keeps the table live via realtime; make sure tasks is published.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tasks'
    ) then
      alter publication supabase_realtime add table public.tasks;
    end if;
  end if;
end $$;
