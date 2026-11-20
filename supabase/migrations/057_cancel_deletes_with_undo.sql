-- ============================================================
-- Come w' me — delete activity on cancel, with a 30-minute undo (v057)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

alter table public.tasks
  add column if not exists cancelled_at timestamptz;

-- ---------- stamp the grace period whenever status changes to/from cancelled ----------
create or replace function public.track_task_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' and old.status = 'cancelled' then
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_track_task_cancellation on public.tasks;
create trigger trg_track_task_cancellation
  before update on public.tasks
  for each row execute function public.track_task_cancellation();

-- ---------- host can bring it back during the grace period ----------
create or replace function public.restore_own_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_requester uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Activity not found';
  end if;
  if v_task.host_id <> auth.uid() then
    raise exception 'Only the host can restore this activity';
  end if;
  if v_task.status <> 'cancelled' then
    raise exception 'This activity is not deleted';
  end if;
  if v_task.cancelled_at is null or now() > v_task.cancelled_at + interval '30 minutes' then
    raise exception 'The 30-minute restore window has closed';
  end if;

  update public.tasks
     set status = case when v_task.spots_filled >= v_task.spots_needed then 'full' else 'open' end,
         cancelled_at = null
   where id = p_task_id;

  for v_requester in
    select distinct requester_id
    from public.join_requests
    where task_id = p_task_id
      and status in ('pending', 'accepted', 'waitlisted')
      and requester_id <> auth.uid()
  loop
    perform public.push_notification(
      v_requester, 'info', 'Activity is back',
      'The host restored "' || v_task.title || '". You can join again.',
      '/task/' || p_task_id::text
    );
  end loop;
end;
$$;

revoke all on function public.restore_own_task(uuid) from public, anon;
grant execute on function public.restore_own_task(uuid) to authenticated;

-- ---------- hard cleanup after the grace window ----------
-- Called by the app on launch/return; no pg_cron dependency.
create or replace function public.cleanup_expired_cancellations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_path text;
  v_count integer := 0;
begin
  for v_task in
    select id, image_url
    from public.tasks
    where status = 'cancelled'
      and cancelled_at is not null
      and now() > cancelled_at + interval '30 minutes'
  loop
    -- stale deep links into a deleted activity
    delete from public.notifications
     where link_path = '/task/' || v_task.id::text
        or link_path like '/task/' || v_task.id::text || '/%';

    -- chat photos / voice notes live under <task-id>/
    delete from storage.objects
     where bucket_id = 'chat-media'
       and (name like v_task.id::text || '/%' or name like '%/' || v_task.id::text || '/%');

    -- the activity flier itself
    if v_task.image_url is not null then
      v_path := split_part(v_task.image_url, '/activity-media/', 2);
      if v_path <> '' then
        delete from storage.objects
         where bucket_id = 'activity-media' and name = v_path;
      end if;
    end if;

    -- cascades: messages, join_requests, chat_read_states, muted/pinned chats,
    -- chat system events, message reactions, task_edit_log
    delete from public.tasks where id = v_task.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.cleanup_expired_cancellations() from public, anon;
grant execute on function public.cleanup_expired_cancellations() to authenticated;
