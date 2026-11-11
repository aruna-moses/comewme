-- ============================================================
-- Come w' me — In-app notifications (v021)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('join_request','selfie','appeal','violation','info','reminder')),
  title      text not null,
  body       text not null,
  link_path  text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists notifications_update_read_own on public.notifications;
create policy notifications_update_read_own on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and read_at is not null);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ============================================================
-- Helper used by every trigger
-- ============================================================
create or replace function public.push_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_body       text,
  p_link_path  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  values (p_user_id, p_type, p_title, p_body, p_link_path);
end;
$$;

grant execute on function public.push_notification(uuid, text, text, text, text) to authenticated;

-- ============================================================
-- Join request decision — notify the applicant
-- ============================================================
create or replace function public.notify_on_join_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if old.status is distinct from new.status
     and new.status in ('accepted', 'waitlisted', 'declined') then
    select title into v_title from public.tasks where id = new.task_id;
    if new.status = 'accepted' then
      perform public.push_notification(
        new.requester_id, 'join_request',
        'You''re in',
        coalesce(v_title, 'Your activity') || ' — the host accepted your request. See you there.',
        '/task/' || new.task_id
      );
    elsif new.status = 'waitlisted' then
      perform public.push_notification(
        new.requester_id, 'join_request',
        'You''re on the waitlist',
        coalesce(v_title, 'Your activity') || ' is full. We will reach out if a spot opens up.',
        '/task/' || new.task_id
      );
    else
      perform public.push_notification(
        new.requester_id, 'join_request',
        'Not this time',
        coalesce(v_title, 'Your activity') || ' — the host went with someone else for this slot.',
        '/task/' || new.task_id
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_join_decision on public.join_requests;
create trigger trg_notify_join_decision
after update on public.join_requests
for each row execute function public.notify_on_join_decision();

-- ============================================================
-- Selfie verification review — notify the member
-- ============================================================
create or replace function public.notify_on_verification_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('approved', 'rejected') then
    perform public.push_notification(
      new.user_id, 'selfie',
      case when new.status = 'approved' then 'Selfie verified' else 'Selfie not accepted' end,
      case when new.status = 'approved'
        then 'You''re officially selfie-verified. The green check now appears on your profile.'
        else 'Your selfie submission did not pass review. Try a clearer face shot in Settings.'
      end,
      '/settings'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_verification_reviewed on public.verifications;
create trigger trg_notify_verification_reviewed
after update on public.verifications
for each row execute function public.notify_on_verification_reviewed();

-- ============================================================
-- Appeal decision — notify the appealer
-- ============================================================
create or replace function public.notify_on_appeal_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('granted', 'denied') then
    perform public.push_notification(
      new.user_id, 'appeal',
      case when new.status = 'granted' then 'Appeal granted' else 'Appeal denied' end,
      case when new.status = 'granted'
        then 'Your appeal was granted. Any restrictions on your account are lifted.'
        else 'Your appeal was denied. Your account status remains unchanged. Check Your reports & decisions for details.'
      end,
      '/violations'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_appeal_decided on public.violation_appeals;
create trigger trg_notify_appeal_decided
after update on public.violation_appeals
for each row execute function public.notify_on_appeal_decided();

-- ============================================================
-- Violation filed about you — notify the reported member
-- ============================================================
create or replace function public.notify_on_violation_filed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    new.user_id, 'violation',
    'A report involves your account',
    'Someone told us something about your activity. It is under review. Tap here to read what they said.',
    '/violations'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_violation_filed on public.violations;
create trigger trg_notify_violation_filed
after insert on public.violations
for each row execute function public.notify_on_violation_filed();

create or replace function public.notify_on_violation_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.severity is distinct from new.severity or old.status is distinct from new.status then
    perform public.push_notification(
      new.user_id, 'violation',
      'A moderation decision was made',
      'Our team reviewed the report and made a call. Tap here to read it.',
      '/violations'
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_violation_reviewed on public.violations;
create trigger trg_notify_violation_reviewed
after update on public.violations
for each row execute function public.notify_on_violation_reviewed();

-- ============================================================
-- Realtime for badges
-- ============================================================
alter publication supabase_realtime add table public.notifications;
