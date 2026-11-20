-- ============================================================
-- Come w' me — time-boxed activity edits with an audit trail (v055)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
--
-- Why: a host who made a typo used to have only one option — cancel the whole
-- activity. Now they get 30 minutes to fix the details, but the original text
-- is never silently rewritten: every change is appended to task_edit_log with
-- its before/after values, and everyone who already joined is notified.
-- ============================================================

-- ---------- append-only edit history ----------
create table if not exists public.task_edit_log (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  edited_by  uuid not null references auth.users(id) on delete cascade,
  edited_at  timestamptz not null default now(),
  changes    jsonb not null default '{}'::jsonb
);

create index if not exists task_edit_log_task_idx
  on public.task_edit_log (task_id, edited_at desc);

alter table public.task_edit_log enable row level security;

drop policy if exists task_edit_log_read_participant on public.task_edit_log;
create policy task_edit_log_read_participant on public.task_edit_log
  for select to authenticated using (public.is_task_participant(task_id));

grant select on public.task_edit_log to authenticated;
revoke insert, update, delete on public.task_edit_log from anon, authenticated;

-- ---------- DB-level guard: the edit window is not just UI ----------
create or replace function public.guard_task_edit_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if (new.title, new.description, new.category, new.area, new.meeting_point, new.date_time, new.spots_needed)
     is distinct from
     (old.title, old.description, old.category, old.area, old.meeting_point, old.date_time, old.spots_needed)
  then
    if auth.uid() is distinct from old.host_id then
      raise exception 'Only the host can change activity details';
    end if;
    if old.status not in ('open', 'full') then
      raise exception 'This activity can no longer be edited';
    end if;
    if now() > old.created_at + interval '30 minutes' then
      raise exception 'The 30-minute edit window has closed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_task_edit_window on public.tasks;
create trigger trg_guard_task_edit_window
  before update on public.tasks
  for each row execute function public.guard_task_edit_window();

-- ---------- audit row on every real detail change ----------
create or replace function public.log_task_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.title is distinct from old.title then
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_array(old.title, new.title));
  end if;
  if new.description is distinct from old.description then
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
  end if;
  if new.category is distinct from old.category then
    v_changes := v_changes || jsonb_build_object('category', jsonb_build_array(old.category, new.category));
  end if;
  if new.area is distinct from old.area then
    v_changes := v_changes || jsonb_build_object('area', jsonb_build_array(old.area, new.area));
  end if;
  if new.meeting_point is distinct from old.meeting_point then
    v_changes := v_changes || jsonb_build_object('meeting_point', jsonb_build_array(old.meeting_point, new.meeting_point));
  end if;
  if new.date_time is distinct from old.date_time then
    v_changes := v_changes || jsonb_build_object('date_time', jsonb_build_array(old.date_time, new.date_time));
  end if;
  if new.spots_needed is distinct from old.spots_needed then
    v_changes := v_changes || jsonb_build_object('spots_needed', jsonb_build_array(old.spots_needed, new.spots_needed));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.task_edit_log (task_id, edited_by, changes)
    values (new.id, coalesce(auth.uid(), old.host_id), v_changes);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_task_edit on public.tasks;
create trigger trg_log_task_edit
  after update on public.tasks
  for each row execute function public.log_task_edit();

-- ---------- host-facing edit RPC ----------
create or replace function public.edit_own_task(
  p_task_id        uuid,
  p_title          text,
  p_description    text,
  p_category       text,
  p_area           text,
  p_meeting_point  text,
  p_date_time      timestamptz,
  p_spots_needed   integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task        public.tasks%rowtype;
  v_accepted    integer;
  v_requester   uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Activity not found';
  end if;
  if v_task.host_id <> auth.uid() then
    raise exception 'Only the host can edit this activity';
  end if;
  if v_task.status not in ('open', 'full') then
    raise exception 'This activity can no longer be edited';
  end if;
  if now() > v_task.created_at + interval '30 minutes' then
    raise exception 'The 30-minute edit window has closed';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 4 and 120 then
    raise exception 'Title must be between 4 and 120 characters';
  end if;
  if btrim(coalesce(p_area, '')) = '' or btrim(coalesce(p_meeting_point, '')) = '' then
    raise exception 'Add an area and a meeting point';
  end if;
  if coalesce(p_category, '') not in (
    'market_run', 'ride', 'food', 'study', 'dev', 'event', 'errands', 'other',
    'movies', 'sports', 'gym', 'outdoors', 'music', 'arts', 'fashion',
    'faith', 'volunteer', 'pets', 'wellness', 'gaming', 'travel',
    'nightlife', 'shopping', 'social', 'health', 'repair'
  ) then
    raise exception 'Choose a valid activity category';
  end if;
  if p_date_time is null or p_date_time <= now() then
    raise exception 'Pick a future date and time';
  end if;
  if p_spots_needed is null or p_spots_needed < 1 then
    raise exception 'Spots must be at least 1';
  end if;

  select count(*) into v_accepted
  from public.join_requests
  where task_id = p_task_id and status = 'accepted';
  if p_spots_needed < v_accepted then
    raise exception 'Spots cannot be fewer than the people already accepted';
  end if;

  update public.tasks
     set title         = btrim(p_title),
         description   = nullif(btrim(coalesce(p_description, '')), ''),
         category      = p_category,
         area          = btrim(p_area),
         meeting_point = btrim(p_meeting_point),
         date_time     = p_date_time,
         spots_needed  = p_spots_needed
   where id = p_task_id;

  -- Tell everyone who already raised a hand: the details they saw may have changed.
  for v_requester in
    select distinct requester_id
    from public.join_requests
    where task_id = p_task_id
      and status in ('pending', 'accepted', 'waitlisted')
      and requester_id <> auth.uid()
  loop
    perform public.push_notification(
      v_requester,
      'info',
      'Activity details updated',
      'The host just updated "' || v_task.title || '" — check the latest details before you go.',
      '/task/' || p_task_id::text
    );
  end loop;
end;
$$;

revoke all on function public.edit_own_task(uuid, text, text, text, text, text, timestamptz, integer) from public, anon;
grant execute on function public.edit_own_task(uuid, text, text, text, text, text, timestamptz, integer) to authenticated;
