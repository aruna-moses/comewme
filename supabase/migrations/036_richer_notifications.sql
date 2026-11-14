-- ============================================================
-- Come w' me — Expanded in-app notifications (v036)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================
-- 1. New activity posted — members with matching interests get notified
-- 2. Activity 1 spot from full — accepted members + host get notified
-- 3. Milestone nudges — a member crossing 1 / 3 / 5 / 10 activities gets notified
-- 4. Reminder the day before — pg_cron hourly (requires pg_cron extension)

-- ---------- 1. New activity: notify interested members (capped 500) ----------
create or replace function public.notify_task_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'open' then
    return new;
  end if;

  -- Notify up to 500 members whose interests include the category, excluding the host
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.id,
    'info',
    left(new.title, 60),
    left('Fresh: ' || coalesce(new.area, 'Lagos'), 130),
    '/task/' || new.id
  from public.profiles p
  where p.id <> new.host_id
    and p.interests @> ARRAY[new.category]::text[]
  order by p.trust_score desc nulls last, p.created_at desc
  limit 500
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_published on public.tasks;
create trigger trg_notify_task_published
after insert on public.tasks
for each row execute function public.notify_task_published();

-- ---------- 2. One spot left on an activity ----------
create or replace function public.notify_spot_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participants int;
  v_remaining int;
begin
  if new.status <> 'open' or new.spots_filled <> old.spots_filled then
    return new;
  end if;

  v_remaining := new.spots_needed - new.spots_filled;

  -- fire only once: when the last spot is about to be taken
  if v_remaining <> 1 or old.spots_needed - old.spots_filled = 1 then
    return new;
  end if;

  select count(*) into v_participants
  from public.join_requests j
  where j.task_id = new.id and j.status = 'accepted';

  -- notify accepted participants AND host (host is implicit in participant count, but notify explicitly to host too)
  insert into public.notifications (user_id, type, title, body, link_path)
  select p.user_id, 'info',
    'Only 1 spot left: ' || left(new.title, 50),
    left(coalesce(new.area, 'Lagos') || ' — grab a seat before it fills', 130),
    '/task/' || new.id
  from (
    select requester_id as user_id
      from public.join_requests
      where task_id = new.id and status = 'accepted'
    union
    select new.host_id
  ) p
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_spot_left on public.tasks;
create trigger trg_notify_spot_left
after update of spots_filled on public.tasks
for each row execute function public.notify_spot_left();

-- ---------- 3. Milestone nudges ----------
create or replace function public.notify_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tasks_completed = old.tasks_completed then
    return new;
  end if;

  if new.tasks_completed = 1 then
    perform public.push_notification(new.id, 'info',
      'First activity complete 🎉',
      'You showed up once. Keep showing up and your trust score climbs.',
      '/'
    );
  elsif new.tasks_completed = 3 then
    perform public.push_notification(new.id, 'info',
      '3 activities in — you are on your way',
      'Consistent members get noticed faster by hosts. Keep going.',
      '/'
    );
  elsif new.tasks_completed = 5 then
    perform public.push_notification(new.id, 'info',
      '5 activities complete — you are a regular now',
      'People start recognising you. Good standing with hosts.',
      '/'
    );
  elsif new.tasks_completed = 10 then
    perform public.push_notification(new.id, 'info',
      '10 activities — legend status approaching',
      'You are one of the most consistent members on Come w\' me.',
      '/'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_milestone on public.profiles;
create trigger trg_notify_milestone
after update of tasks_completed on public.profiles
for each row execute function public.notify_milestone();

-- ---------- 4. Day-before reminder: pg_cron-driven ----------
-- Requires the pg_cron extension to be enabled in your project (Database -> Extensions).
-- If it is missing, the scheduling step will simply log a warning.
create extension if not exists pg_cron with schema extensions;

create or replace function public.notify_upcoming_reminder()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select t.id as task_id, t.title, t.date_time, j.requester_id
      from public.tasks t
      join public.join_requests j on j.task_id = t.id and j.status = 'accepted'
      where t.date_time::date = ((now() at time zone 'Africa/Lagos')::date + 1)
        and not exists (
          select 1 from public.notifications n
          where n.type = 'reminder'
            and n.link_path = '/task/' || t.id
            and n.user_id = j.requester_id
        )
  loop
    perform public.push_notification(
      v_row.requester_id, 'reminder',
      left('See you ' || to_char((v_row.date_time at time zone 'Africa/Lagos') + interval '1 hour', 'HH24:MI') || ' tomorrow: ' || coalesce(v_row.title, 'your activity'), 60),
      'We are in Lagos — 24 hours until ' || coalesce(v_row.title, 'the activity') || '. Tap to remind yourself.',
      '/task/' || v_row.task_id
    );
  end loop;

  -- also nudge hosts whose activity tomorrow still has applications to decide
  for v_row in
    select t.id as task_id, t.title, j.requester_name
      from public.tasks t
      join public.join_requests j on j.task_id = t.id and j.status = 'pending'
      where t.date_time::date = ((now() at time zone 'Africa/Lagos')::date + 1)
        and not exists (
          select 1 from public.notifications n
          where n.type = 'reminder'
            and n.link_path = '/task/' || t.id
            and n.user_id = t.host_id
        )
  loop
    perform public.push_notification(
      (select host_id from public.tasks where id = v_row.task_id),
      'reminder',
      left('Applications waiting: ' || coalesce(v_row.title, 'your activity'), 60),
      coalesce(v_row.requester_name, 'Someone') || ' is waiting on you — activity is tomorrow.',
      '/task/' || v_row.task_id
    );
  end loop;
end;
$$;

-- Schedule hourly — safe to re-run; silently skips if pg_cron isn't available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('notify-upcoming', '0 * * * *', 'SELECT public.notify_upcoming_reminder()');
  else
    raise notice 'pg_cron is not enabled — skip scheduling for now.';
  end if;
exception when others then
  raise notice 'Could not schedule pg_cron job (will skip): %', sqlerrm;
end
$$;

select public.notify_upcoming_reminder();
