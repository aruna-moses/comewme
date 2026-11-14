-- ============================================================
-- Come w' me — Moderation inbox (v14)
-- Run in Supabase SQL Editor -> New query -> Run
-- Requires 012 (moderators) and 013 (advertisements).
-- ============================================================

-- ---------- SOS alerts visible to moderators ----------

drop policy if exists sos_read_moderator on public.sos_alerts;
create policy sos_read_moderator on public.sos_alerts
  for select to authenticated using (public.is_moderator());

drop policy if exists sos_update_moderator on public.sos_alerts;
create policy sos_update_moderator on public.sos_alerts
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

create index if not exists sos_alerts_status_idx
  on public.sos_alerts (status, created_at desc);

-- ---------- SOS list for the inbox ----------

create or replace function public.list_sos_alerts()
returns table (
  id uuid,
  task_id uuid,
  task_title text,
  user_id uuid,
  display_name text,
  username text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  media_url text,
  media_type text,
  status text,
  admin_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
    select s.id, s.task_id, t.title, s.user_id, p.display_name, p.username,
           s.location_lat, s.location_lng, s.location_address,
           s.media_url, s.media_type, s.status, s.admin_note,
           s.created_at, s.reviewed_at
    from public.sos_alerts s
    left join public.profiles p on p.id = s.user_id
    left join public.tasks t on t.id = s.task_id
    order by s.created_at desc
    limit 100;
end;
$$;

grant execute on function public.list_sos_alerts() to authenticated;

-- ---------- Mark an SOS handled ----------

create or replace function public.review_sos_alert(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_status not in ('pending', 'reviewed', 'resolved', 'false_alarm') then
    raise exception 'Unknown SOS status: %', p_status;
  end if;

  update public.sos_alerts
     set status = p_status,
         admin_note = p_note,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_id;
end;
$$;

grant execute on function public.review_sos_alert(uuid, text, text) to authenticated;

-- ---------- One call for every badge ----------

create or replace function public.moderation_counts()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_moderator() then
    return json_build_object(
      'is_moderator', false, 'sos', 0, 'reports', 0, 'appeals', 0, 'ads', 0,
      'latest_sos', null
    );
  end if;

  select json_build_object(
    'is_moderator', true,
    'sos', (select count(*) from public.sos_alerts where status = 'pending'),
    'reports', (select count(*) from public.violations where status = 'pending'),
    'appeals', (select count(*) from public.violation_appeals where status = 'pending'),
    'ads', (select count(*) from public.advertisements where status = 'pending'),
    'latest_sos', (
      select row_to_json(x)
      from (
        select s.id, s.created_at, s.location_address, p.display_name, t.title as task_title
        from public.sos_alerts s
        left join public.profiles p on p.id = s.user_id
        left join public.tasks t on t.id = s.task_id
        where s.status = 'pending'
        order by s.created_at desc
        limit 1
      ) x
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.moderation_counts() to authenticated;

-- ---------- Let moderators see the moderator team ----------

drop policy if exists moderators_read_all on public.moderators;
create policy moderators_read_all on public.moderators
  for select to authenticated using (public.is_moderator());
