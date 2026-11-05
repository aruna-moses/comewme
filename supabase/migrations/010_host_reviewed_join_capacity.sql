-- Host-reviewed applications with waitlisting and strict spot limits.
-- Run in Supabase SQL Editor -> New query -> Run.

alter table public.tasks
  alter column fill_mode set default 'review';

update public.tasks
   set fill_mode = 'review'
 where fill_mode is distinct from 'review';

alter table public.tasks
  alter column fill_mode set not null;

alter table public.tasks
  drop constraint if exists tasks_fill_mode_check;

alter table public.tasks
  add constraint tasks_fill_mode_check check (fill_mode = 'review');

alter table public.join_requests
  drop constraint if exists join_requests_status_check;

alter table public.join_requests
  add constraint join_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'waitlisted'));

create or replace function public.guard_join_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_needed int;
  v_task_status text;
  v_accepted int;
begin
  if tg_op = 'INSERT' then
    select host_id, spots_needed, status
      into v_host, v_needed, v_task_status
      from public.tasks
     where id = new.task_id
     for update;

    if not found then
      raise exception 'Activity not found';
    end if;

    if auth.uid() is not null then
      if auth.uid() <> new.requester_id or auth.uid() = v_host then
        raise exception 'You can only request to join as yourself';
      end if;
      if v_task_status <> 'open' then
        raise exception 'This activity is no longer accepting requests';
      end if;
      new.status := 'pending';
    end if;
    return new;
  end if;

  select host_id, spots_needed, status
    into v_host, v_needed, v_task_status
    from public.tasks
   where id = old.task_id
   for update;

  new.task_id      := old.task_id;
  new.requester_id := old.requester_id;
  new.created_at   := old.created_at;

  if auth.uid() = v_host then
    if new.status not in ('accepted', 'declined', 'pending', 'waitlisted') then
      new.status := old.status;
    elsif new.status = 'accepted' and old.status <> 'accepted' then
      if old.status = 'withdrawn' or v_task_status not in ('open', 'full') then
        raise exception 'This application can no longer be accepted';
      end if;

      select count(*) into v_accepted
        from public.join_requests
       where task_id = old.task_id
         and status = 'accepted';
      if v_accepted >= v_needed then
        raise exception 'No spots are available for this activity';
      end if;
    end if;
  elsif auth.uid() = old.requester_id then
    if new.status = 'withdrawn' and old.status in ('pending', 'waitlisted', 'accepted') then
      null;
    elsif new.status = 'pending'
      and old.status in ('declined', 'withdrawn')
      and v_task_status = 'open' then
      null;
    else
      new.status := old.status;
    end if;
  else
    new.status := old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_join_status on public.join_requests;
create trigger trg_guard_join_status
before insert or update on public.join_requests
for each row execute function public.guard_join_status();

-- Existing over-capacity groups are preserved. New acceptances are blocked until
-- their accepted count falls below the task's requested capacity.
