-- ============================================================
-- Come w' me — Verification review queue (v017)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- Moderators may read all verification rows (owners already have read-own).
drop policy if exists verifications_read_moderator on public.verifications;
create policy verifications_read_moderator on public.verifications
  for select to authenticated using (public.is_moderator());

-- Moderators may update status / admin_note (only moderators).
drop policy if exists verifications_update_moderator on public.verifications;
create policy verifications_update_moderator on public.verifications
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Moderators may view selfie objects in the private bucket.
drop policy if exists verifications_media_moderator on storage.objects;
create policy verifications_media_moderator on storage.objects
  for select to authenticated
  using (bucket_id = 'verifications' and public.is_moderator());

-- What moderators need to judge a submission in one look.
create or replace function public.list_pending_verifications()
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  selfie_path text,
  status text,
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
    select v.id, v.user_id, p.display_name, p.username, p.avatar_url,
           v.selfie_url, v.status, v.created_at
    from public.verifications v
    join public.profiles p on p.id = v.user_id
    where v.status = 'pending'
    order by v.created_at asc;
end;
$$;

grant execute on function public.list_pending_verifications() to authenticated;

-- Approve or reject a submission in one call.
create or replace function public.review_verification(
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
  v_user uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'p_status must be approved or rejected';
  end if;

  select user_id into v_user
  from public.verifications
  where id = p_id;

  if v_user is null then
    raise exception 'Verification % not found', p_id;
  end if;

  update public.verifications
     set status = p_status,
         admin_note = p_note,
         reviewed_at = now()
   where id = p_id;

  -- Verified people wear the badge across the whole app.
  if p_status = 'approved' then
    update public.profiles
       set verification_status = 'verified'
     where id = v_user;
  else
    update public.profiles
       set verification_status = 'unverified'
     where id = v_user;
  end if;
end;
$$;

grant execute on function public.review_verification(uuid, text, text) to authenticated;

-- Add verification queue into the shared counter JSON shape.
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
      'sos', 0, 'reports', 0, 'appeals', 0, 'ads', 0, 'verifications', 0,
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
