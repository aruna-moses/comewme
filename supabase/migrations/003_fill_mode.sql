-- ============================================================
-- Come w' me — fill mode migration (v3)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- 1) Add fill_mode to tasks
alter table public.tasks
  add column if not exists fill_mode text default 'review' check (fill_mode in ('review', 'first_come'));

-- 2) Update guard trigger to preserve fill_mode on host updates
--    (the trigger already freezes is_sponsored; we extend it to fill_mode too)

create or replace function public.guard_task_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() = new.host_id then
      select display_name, avatar_url
        into new.host_name, new.host_avatar_url
      from public.profiles where id = new.host_id;

      new.spots_filled    := 0;
      new.status          := 'open';
      new.is_sponsored    := false;
      new.sponsor_name    := null;
      new.sponsored_until := null;
    end if;
    return new;
  end if;

  select count(*) into v_accepted
  from public.join_requests
  where task_id = new.id and status = 'accepted';

  new.spots_filled := v_accepted;
  new.host_id      := old.host_id;
  new.created_at   := old.created_at;

  if auth.uid() = old.host_id and pg_trigger_depth() = 1 then
    new.is_sponsored    := old.is_sponsored;
    new.sponsor_name    := old.sponsor_name;
    new.sponsored_until := old.sponsored_until;
    new.fill_mode       := old.fill_mode;   -- host can't switch modes after posting
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_task_fields on public.tasks;
create trigger trg_guard_task_fields
before insert or update on public.tasks
for each row execute function public.guard_task_fields();

-- 3) Allow requesters to accept themselves in FCFS mode
create or replace function public.guard_join_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_fill_mode text;
begin
  select host_id, fill_mode into v_host, v_fill_mode from public.tasks where id = old.task_id;

  new.task_id      := old.task_id;
  new.requester_id := old.requester_id;
  new.created_at   := old.created_at;

  if auth.uid() = v_host then
    -- The host decides. Anything that is not an accept/decline is ignored.
    if new.status not in ('accepted', 'declined', 'pending') then
      new.status := old.status;
    end if;
  elsif auth.uid() = old.requester_id then
    -- A requester may only pull out, unless FCFS and claiming a spot.
    if v_fill_mode = 'first_come' and new.status = 'accepted' then
      -- allowed: claiming a spot in FCFS
    elsif new.status not in ('withdrawn', 'pending') then
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
before update on public.join_requests
for each row execute function public.guard_join_status();

-- 4) Index for FCFS lookups
create index if not exists tasks_fill_mode_idx on public.tasks (fill_mode);
