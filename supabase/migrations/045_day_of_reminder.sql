-- Same-day reminder: activity is happening today. Twin of the day-before job
-- in 036_richer_notifications.sql. Fires through the same push_notification
-- gateway -> notifications insert -> DB webhook -> send-push -> FCM.

create or replace function public.notify_day_of_reminder()
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
      where t.date_time::date = (now() at time zone 'Africa/Lagos')::date
        and not exists (
          select 1 from public.notifications n
          where n.type = 'reminder'
            and n.link_path = '/task/' || t.id
            and n.user_id = j.requester_id
            and n.title like 'It''s today:%'
        )
  loop
    perform public.push_notification(
      v_row.requester_id,
      'reminder',
      left('It''s today: ' || coalesce(v_row.title, 'your activity'), 60),
      'We are in Lagos - your activity is today at ' ||
        to_char((v_row.date_time at time zone 'Africa/Lagos') + interval '1 hour', 'HH24:MI') ||
        '. Tap to open the group.',
      '/task/' || v_row.task_id
    );
  end loop;
end;
$$;

-- Schedule hourly. Same pattern as the day-before job: skip gracefully if
-- pg_cron is unavailable instead of failing the migration.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('notify-day-of', '0 * * * *', 'SELECT public.notify_day_of_reminder()');
  else
    raise notice 'pg_cron is not enabled - skip scheduling for now.';
  end if;
exception when others then
  raise notice 'Could not schedule pg_cron job (will skip): %', sqlerrm;
end
$$;

select public.notify_day_of_reminder();
