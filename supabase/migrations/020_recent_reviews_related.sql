-- ============================================================
-- Come w' me — Jump-back references for reviewed history (v020)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

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
  ) combined
  order by reviewed_at desc
  limit p_limit;
end;
$$;

grant execute on function public.list_recent_reviews(integer) to authenticated;
