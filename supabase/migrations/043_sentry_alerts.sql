-- Sentry crash/issue alerts surfaced inside the moderation inbox.
--
-- Flow: Sentry issue alert rule
--   -> HTTP POST webhook -> edge function `sentry-alert`
--   -> insert public.admin_alerts (deduped on sentry_issue_id)
--   -> insert one notifications row per moderator
--   -> Database Webhook fires -> send-push -> FCM push to moderators' phones

create table if not exists public.admin_alerts (
  id               uuid primary key default gen_random_uuid(),
  source           text not null default 'sentry',
  sentry_issue_id  text,
  level            text not null default 'error',
  title            text not null,
  culprit          text,
  url              text,
  acknowledged     boolean not null default false,
  acknowledged_by  uuid references auth.users(id) on delete set null,
  acknowledged_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- Dedupe: an alert row exists once per Sentry issue, so re-fires never spam the inbox.
create unique index if not exists admin_alerts_sentry_issue_idx
  on public.admin_alerts (sentry_issue_id)
  where sentry_issue_id is not null;

alter table public.admin_alerts enable row level security;

drop policy if exists admin_alerts_read_moderators on public.admin_alerts;
create policy admin_alerts_read_moderators on public.admin_alerts
  for select to authenticated
  using (public.is_moderator());

drop policy if exists admin_alerts_ack_moderators on public.admin_alerts;
create policy admin_alerts_ack_moderators on public.admin_alerts
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Inserts come from the edge function via service_role, which bypasses RLS.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'admin_alerts'
  ) then
    alter publication supabase_realtime add table public.admin_alerts;
  end if;
end $$;
