-- ============================================================
-- Come w' me — Fix: moderator-approving-own-selfie, or any
-- auth.uid() match, silently got reverted by the profile guard.
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- Same guard, with one more bypass: an explicit request-scoped flag
-- (\u0000)set by a moderator reviewing a verification before they touch profiles.
create or replace function public.guard_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() = new.id then
      new.verification_status := 'unverified';
      new.trust_score         := 0;
      new.tasks_completed     := 0;
      new.no_shows            := 0;
    end if;
    return new;
  end if;

  -- Allow moderation review functions to flip verification_status and nothing else.
  if coalesce(current_setting('myapp.moderator_review', true), '') = 'true' then
    new.trust_score     := old.trust_score;
    new.tasks_completed := old.tasks_completed;
    new.no_shows        := old.no_shows;
    return new;
  end if;

  if auth.uid() = old.id and pg_trigger_depth() = 1 then
    new.verification_status := old.verification_status;
    new.trust_score         := old.trust_score;
    new.tasks_completed     := old.tasks_completed;
    new.no_shows            := old.no_shows;
  end if;
  return new;
end;
$$;

-- Re-create review_verification so it sets the flag around its profile update.
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

  -- The trigger needs to know we're the moderation act, not the member.
  perform set_config('myapp.moderator_review', 'true', true);

  if p_status = 'approved' then
    update public.profiles
       set verification_status = 'verified'
     where id = v_user;
  else
    update public.profiles
       set verification_status = 'unverified'
     where id = v_user;
  end if;

  perform set_config('myapp.moderator_review', 'false', true);
end;
$$;
