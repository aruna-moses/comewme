-- ============================================================
-- Come w' me — Moderator notifications for new violations/reports/appeals (v025)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- Notify every moderator whenever a new violation is filed about a member.
create or replace function public.notify_moderators_on_violation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  select category into v_title from public.violations where id = new.id;

  insert into public.notifications (user_id, type, title, body, link_path)
  select
    m.user_id,
    'violation',
    'New report to review',
    'A member was reported for ' || coalesce(v_title, 'community rules') || '. Tap to review.',
    '/admin/moderation'
  from public.moderators m;

  return new;
end;
$$;

drop trigger if exists trg_notify_moderators_on_violation_insert on public.violations;
create trigger trg_notify_moderators_on_violation_insert
after insert on public.violations
for each row execute function public.notify_moderators_on_violation_insert();

-- Notify moderators when a member submits feedback/complaint.
create or replace function public.notify_moderators_on_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    m.user_id,
    'info',
    'New member feedback',
    'A member submitted feedback (' || coalesce(new.category, 'unspecified') || '). Tap to read and respond.',
    '/admin/moderation'
  from public.moderators m;

  return new;
end;
$$;

drop trigger if exists trg_notify_moderators_on_feedback_insert on public.reports;
create trigger trg_notify_moderators_on_feedback_insert
after insert on public.reports
for each row execute function public.notify_moderators_on_feedback_insert();

-- Notify moderators when a member appeals a decision.
create or replace function public.notify_moderators_on_appeal_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    m.user_id,
    'appeal',
    'Appeal requested',
    'A member filed an appeal. Tap to review the original decision and the appeal letter.',
    '/admin/moderation'
  from public.moderators m;

  return new;
end;
$$;

drop trigger if exists trg_notify_moderators_on_appeal_insert on public.violation_appeals;
create trigger trg_notify_moderators_on_appeal_insert
after insert on public.violation_appeals
for each row execute function public.notify_moderators_on_appeal_insert();
