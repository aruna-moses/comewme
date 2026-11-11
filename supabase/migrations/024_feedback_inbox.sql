-- ============================================================
-- Come w' me — Member feedback inbox (v024)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- Moderators can read all member feedback, including their own and anonymous-ish chains.
drop policy if exists reports_read_moderator on public.reports;
create policy reports_read_moderator on public.reports
  for select to authenticated using (public.is_moderator());

drop policy if exists reports_update_moderator on public.reports;
create policy reports_update_moderator on public.reports
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Add columns moderators need to attach a short reply and the reviewer.
alter table public.reports
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Moderator inbox listing — one row per member feedback item.
create or replace function public.list_feedback_for_moderator()
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  reporter_username text,
  category text,
  details text,
  reported_user_id uuid,
  reported_name text,
  task_id uuid,
  task_title text,
  status text,
  admin_note text,
  created_at timestamptz
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
    select
      r.id,
      r.reporter_id,
      pr.display_name,
      pr.username,
      r.category,
      r.details,
      r.reported_user_id,
      q.display_name as reported_name,
      r.task_id,
      t.title as task_title,
      r.status,
      r.admin_note,
      r.created_at
    from public.reports r
    left join public.profiles pr on pr.id = r.reporter_id
    left join public.profiles q on q.id = r.reported_user_id
    left join public.tasks t on t.id = r.task_id
    order by case r.status when 'open' then 0 when 'reviewing' then 1 else 2 end,
             r.created_at asc;
end;
$$;

grant execute on function public.list_feedback_for_moderator() to authenticated;

-- Moderator marks feedback as reviewed / resolves it, optionally sends a short note back.
create or replace function public.review_feedback(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_status not in ('reviewing', 'resolved') then
    raise exception 'p_status must be reviewing or resolved';
  end if;

  select reporter_id into v_reporter from public.reports where id = p_id;

  update public.reports
     set status = p_status,
         admin_note = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;

  if v_reporter is not null then
    perform public.push_notification(
      v_reporter,
      'info',
      'We read your feedback',
      left(coalesce(p_note, 'Thanks for flagging this — we''ll take it from here.'), 160),
      '/settings'
    );
  end if;
end;
$$;

grant execute on function public.review_feedback(uuid, text, text) to authenticated;

-- Count feeds into the moderation badge
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
      'is_moderator', false,
      'sos', 0, 'reports', 0, 'appeals', 0, 'ads', 0, 'verifications', 0, 'feedback', 0,
      'latest_sos', null
    );
  end if;

  select json_build_object(
    'is_moderator', true,
    'sos', (select count(*) from public.sos_alerts where status = 'pending'),
    'reports', (select count(*) from public.violations where status = 'pending'),
    'appeals', (select count(*) from public.violation_appeals where status = 'pending'),
    'ads', (select count(*) from public.advertisements where status = 'pending'),
    'verifications', (select count(*) from public.verifications where status = 'pending'),
    'feedback', (select count(*) from public.reports where status = 'open'),
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

create index if not exists reports_status_idx on public.reports (status, created_at);

-- History expanded to include feedback items too, so nothing the admin replied to is lost.
drop function if exists public.list_recent_reviews(integer);

create or replace function public.list_recent_reviews(p_limit integer default 30)
returns table (
  kind text,
  id uuid,
  title text,
  status text,
  note text,
  reviewed_at timestamptz,
  display_name text,
  username text,
  detail jsonb,
  related_kind text,
  related_id uuid
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
  select * from (
    select
      'sos'::text as kind,
      s.id,
      coalesce(t.title, 'SOS alert')::text as title,
      s.status,
      s.admin_note::text as note,
      s.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'task_title', t.title,
        'location_lat', s.location_lat,
        'location_lng', s.location_lng,
        'location_address', s.location_address,
        'media_url', s.media_url,
        'media_type', s.media_type
      ) as detail,
      'task'::text as related_kind,
      s.task_id as related_id
    from public.sos_alerts s
    left join public.profiles p on p.id = s.user_id
    left join public.tasks t on t.id = s.task_id
    where s.reviewed_at is not null
    union all
    select
      'report'::text as kind,
      v.id,
      v.category::text as title,
      v.status,
      coalesce(v.action_taken, '')::text as note,
      v.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'description', v.description,
        'severity', v.severity,
        'action_taken', v.action_taken,
        'reported_by', rb.display_name
      ) as detail,
      'profile'::text as related_kind,
      v.user_id as related_id
    from public.violations v
    left join public.profiles p on p.id = v.user_id
    left join public.profiles rb on rb.id = v.reported_by
    where v.reviewed_at is not null
    union all
    select
      'appeal'::text as kind,
      a.id,
      ('appeal — ' || v.category)::text as title,
      a.status,
      a.admin_response::text as note,
      a.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'appeal_reason', a.appeal_reason,
        'admin_response', a.admin_response,
        'violation_description', v.description,
        'violation_category', v.category,
        'violation_severity', v.severity
      ) as detail,
      'profile'::text as related_kind,
      a.user_id as related_id
    from public.violation_appeals a
    join public.violations v on v.id = a.violation_id
    left join public.profiles p on p.id = a.user_id
    where a.reviewed_at is not null
    union all
    select
      'ad'::text as kind,
      ad.id,
      (ad.brand_name || ' — ' || ad.headline)::text as title,
      ad.status,
      ad.admin_note::text as note,
      ad.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'brand_name', ad.brand_name,
        'cta_text', ad.cta_text,
        'destination_url', ad.destination_url,
        'image_url', ad.image_url,
        'brand_color', ad.brand_color,
        'start_date', ad.start_date,
        'end_date', ad.end_date
      ) as detail,
      'admin_ads'::text as related_kind,
      null::uuid as related_id
    from public.advertisements ad
    left join public.profiles p on p.id = ad.advertiser_id
    where ad.reviewed_at is not null
    union all
    select
      'verification'::text as kind,
      ver.id,
      ('selfie — ' || coalesce(p.display_name, 'member'))::text as title,
      ver.status,
      ver.admin_note::text as note,
      ver.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'selfie_path', ver.selfie_url,
        'avatar_url', p.avatar_url,
        'username', p.username
      ) as detail,
      'profile'::text as related_kind,
      ver.user_id as related_id
    from public.verifications ver
    left join public.profiles p on p.id = ver.user_id
    where ver.reviewed_at is not null
    union all
    select
      'feedback'::text as kind,
      r.id,
      r.category::text as title,
      r.status,
      r.admin_note::text as note,
      r.reviewed_at,
      p.display_name,
      p.username,
      jsonb_build_object(
        'details', r.details,
        'reported_user_id', r.reported_user_id,
        'task_id', r.task_id,
        'admin_note', r.admin_note
      ) as detail,
      'profile'::text as related_kind,
      r.reporter_id as related_id
    from public.reports r
    left join public.profiles p on p.id = r.reporter_id
    where r.reviewed_at is not null
  ) combined
  order by reviewed_at desc
  limit p_limit;
end;
$$;

grant execute on function public.list_recent_reviews(integer) to authenticated;
