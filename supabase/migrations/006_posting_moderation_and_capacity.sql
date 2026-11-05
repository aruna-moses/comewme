-- Remove the arbitrary activity-size cap and add reviewed account posting controls.
alter table public.tasks
  drop constraint if exists tasks_spots_needed_check,
  add constraint tasks_spots_needed_check check (spots_needed >= 1);

create table if not exists public.account_posting_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  distinct_reporter_count integer not null default 0 check (distinct_reporter_count >= 0),
  review_required boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text,
  updated_at timestamptz not null default now()
);

alter table public.account_posting_controls enable row level security;
revoke all on public.account_posting_controls from anon;
revoke insert, update, delete on public.account_posting_controls from anon, authenticated;
grant select on public.account_posting_controls to authenticated;

drop policy if exists account_posting_controls_read_own on public.account_posting_controls;
create policy account_posting_controls_read_own on public.account_posting_controls
  for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.refresh_posting_review_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_count integer;
begin
  if p_user_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(distinct reporter_id)::integer
    into v_reporter_count
  from public.reports
  where reported_user_id = p_user_id
    and reporter_id is not null
    and reporter_id <> p_user_id
    and status in ('open', 'reviewing');

  insert into public.account_posting_controls (
    user_id,
    distinct_reporter_count,
    review_required,
    updated_at
  )
  values (
    p_user_id,
    v_reporter_count,
    v_reporter_count >= 3,
    now()
  )
  on conflict (user_id) do update
    set distinct_reporter_count = excluded.distinct_reporter_count,
        review_required = excluded.review_required,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.refresh_posting_review_for_user(uuid) from public, anon, authenticated;

create or replace function public.refresh_posting_review_after_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.reported_user_id is distinct from new.reported_user_id then
    perform public.refresh_posting_review_for_user(old.reported_user_id);
  end if;
  perform public.refresh_posting_review_for_user(new.reported_user_id);
  return new;
end;
$$;

drop trigger if exists trg_refresh_posting_review_after_report on public.reports;
create trigger trg_refresh_posting_review_after_report
after insert or update of status, reported_user_id, reporter_id on public.reports
for each row execute function public.refresh_posting_review_after_report();

insert into public.account_posting_controls (
  user_id,
  distinct_reporter_count,
  review_required,
  updated_at
)
select
  reported_user_id,
  count(distinct reporter_id)::integer,
  count(distinct reporter_id) >= 3,
  now()
from public.reports
where reported_user_id is not null
  and reporter_id is not null
  and reporter_id <> reported_user_id
  and status in ('open', 'reviewing')
group by reported_user_id
on conflict (user_id) do update
  set distinct_reporter_count = excluded.distinct_reporter_count,
      review_required = excluded.review_required,
      updated_at = excluded.updated_at;

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert with check (
    auth.uid() = host_id
    and not exists (
      select 1
      from public.account_posting_controls controls
      where controls.user_id = auth.uid()
        and controls.suspended_at is not null
    )
  );
