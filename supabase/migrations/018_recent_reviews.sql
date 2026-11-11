-- ============================================================
-- Come w' me — Reviewed history for the moderation inbox (v018)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create index if not exists sos_alerts_reviewed_at_idx on public.sos_alerts (reviewed_at desc) where reviewed_at is not null;
create index if not exists violations_reviewed_at_idx on public.violations (reviewed_at desc) where reviewed_at is not null;
create index if not exists violation_appeals_reviewed_at_idx on public.violation_appeals (reviewed_at desc) where reviewed_at is not null;
create index if not exists advertisements_reviewed_at_idx on public.advertisements (reviewed_at desc) where reviewed_at is not null;
create index if not exists verifications_reviewed_at_idx on public.verifications (reviewed_at desc) where reviewed_at is not null;

create or replace function public.list_recent_reviews(p_limit integer default 30)
returns table (
  kind text,
  id uuid,
  title text,
  status text,
  note text,
  reviewed_at timestamptz,
  display_name text,
  username text
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
      p.username
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
      p.username
    from public.violations v
    left join public.profiles p on p.id = v.user_id
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
      p.username
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
      p.username
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
      p.username
    from public.verifications ver
    left join public.profiles p on p.id = ver.user_id
    where ver.reviewed_at is not null
  ) combined
  order by reviewed_at desc
  limit p_limit;
end;
$$;

grant execute on function public.list_recent_reviews(integer) to authenticated;
