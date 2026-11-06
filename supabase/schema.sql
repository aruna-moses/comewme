-- ============================================================
-- Come w' me — database schema
-- Postgres / Supabase
--
-- Run this in Supabase Studio -> SQL Editor -> New query -> Run.
-- Then apply migrations/012_community_guidelines_and_violations.sql for
-- mandatory guidelines acceptance and the moderation system.
-- It is idempotent-ish: drop-first, so only run on a fresh project.
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null,
  username            text not null unique,
  avatar_url          text,
  area                text,
  city                text not null default 'Lagos',
  bio                 text,
  phone               text,
  community_check_passed_at timestamptz,
  character_persona   text check (character_persona in (
                        'tari','ibrahim','zainab','tunde','runo',
                        'kemi','ese','ngozi','david','maya','burna','chidi'
                      )),
  interests           text[] not null default '{}',
  trust_score         int not null default 0,
  tasks_completed     int not null default 0,
  no_shows            int not null default 0,
  verification_status text not null default 'unverified'
                      check (verification_status in ('unverified','pending','verified')),
  created_at          timestamptz not null default now()
);

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references public.profiles(id) on delete cascade,
  host_name         text not null,
  host_avatar_url   text,
  title             text not null check (char_length(title) between 4 and 120),
  description       text,
  category          text not null
                    check (category in ('market_run','ride','food','study','dev','event','errands','other')),
  area              text not null,
  city              text not null default 'Lagos',
  meeting_point     text not null,
  date_time         timestamptz not null,
  spots_needed      int not null check (spots_needed >= 1),
  spots_filled      int not null default 0 check (spots_filled >= 0),
  status            text not null default 'open'
                    check (status in ('open','full','completed','cancelled')),
  fill_mode         text not null default 'review'
                    check (fill_mode = 'review'),
  is_sponsored      boolean not null default false,
  sponsor_name      text,
  sponsored_until   date,
  created_at        timestamptz not null default now()
);

create table if not exists public.join_requests (
  id                    uuid primary key default gen_random_uuid(),
  task_id               uuid not null references public.tasks(id) on delete cascade,
  requester_id          uuid not null references public.profiles(id) on delete cascade,
  requester_name        text not null,
  requester_avatar_url  text,
  message               text,
  status                text not null default 'pending'
                        check (status in ('pending','accepted','declined','withdrawn','waitlisted')),
  created_at            timestamptz not null default now(),
  unique (task_id, requester_id)
);

create table if not exists public.messages (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks(id) on delete cascade,
  sender_id          uuid not null references public.profiles(id) on delete cascade,
  sender_name        text not null,
  sender_avatar_url  text,
  body               text not null,
  type               text not null default 'text' check (type in ('text','image','audio')),
  url                text,
  duration           int,
  reply_to_message_id uuid,
  reply_to_sender_name text,
  reply_to_preview    text,
  deleted_at         timestamptz,
  constraint messages_reply_snapshot_check check (
    (reply_to_message_id is null and reply_to_sender_name is null and reply_to_preview is null)
    or (reply_to_message_id is not null and reply_to_sender_name is not null and reply_to_preview is not null)
  ),
  constraint messages_body_check check (
    (type = 'text' and char_length(body) between 1 and 2000)
    or (type in ('image','audio') and char_length(body) = 0)
  ),
  created_at         timestamptz not null default now()
);

alter table public.messages
  add column if not exists reply_to_message_id uuid,
  add column if not exists reply_to_sender_name text,
  add column if not exists reply_to_preview text,
  add column if not exists deleted_at timestamptz;

alter table public.messages
  drop constraint if exists messages_reply_snapshot_check,
  add constraint messages_reply_snapshot_check check (
    (reply_to_message_id is null and reply_to_sender_name is null and reply_to_preview is null)
    or (reply_to_message_id is not null and reply_to_sender_name is not null and reply_to_preview is not null)
  );

create or replace function public.guard_message_soft_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() <> old.sender_id or not public.is_task_participant(old.task_id) then
    raise exception 'You can only delete your own messages while you are a group member';
  end if;

  if old.deleted_at is not null
    or new.deleted_at is null
    or new.body <> 'This message was deleted'
    or new.type <> 'text'
    or new.url is not null
    or new.duration is not null
    or new.id is distinct from old.id
    or new.task_id is distinct from old.task_id
    or new.sender_id is distinct from old.sender_id
    or new.sender_name is distinct from old.sender_name
    or new.sender_avatar_url is distinct from old.sender_avatar_url
    or new.reply_to_message_id is distinct from old.reply_to_message_id
    or new.reply_to_sender_name is distinct from old.reply_to_sender_name
    or new.reply_to_preview is distinct from old.reply_to_preview
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Messages can only be deleted';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_message_soft_delete on public.messages;
create trigger trg_guard_message_soft_delete
before update on public.messages
for each row execute function public.guard_message_soft_delete();

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  reviewer_id  uuid not null references public.profiles(id) on delete cascade,
  reviewee_id  uuid not null references public.profiles(id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (task_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  constraint profile_media_path_owner check (storage_path like profile_id::text || '/%')
);

create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references public.profiles(id) on delete set null,
  reported_user_id  uuid references public.profiles(id) on delete set null,
  task_id           uuid references public.tasks(id) on delete set null,
  category          text not null
                    check (category in ('harassment','no_show','fake_profile','scam','inappropriate','feedback','other')),
  details           text not null check (char_length(details) between 3 and 4000),
  status            text not null default 'open'
                    check (status in ('open','reviewing','resolved')),
  created_at        timestamptz not null default now()
);

create table if not exists public.account_posting_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  distinct_reporter_count integer not null default 0 check (distinct_reporter_count >= 0),
  review_required boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text,
  updated_at timestamptz not null default now()
);

-- Private. Selfies are only ever visible to the owner and to the service role.
create table if not exists public.verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references public.profiles(id) on delete cascade,
  selfie_url   text not null,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- ============================================================
-- INDEXES (the read paths that matter)
-- ============================================================

create index if not exists tasks_feed_idx        on public.tasks (status, date_time);
create index if not exists tasks_host_idx        on public.tasks (host_id);
create index if not exists tasks_sponsored_idx   on public.tasks (is_sponsored, created_at desc);
create index if not exists tasks_area_idx        on public.tasks (area);
create index if not exists tasks_category_idx    on public.tasks (category);
create index if not exists tasks_fill_mode_idx   on public.tasks (fill_mode);
create index if not exists join_task_idx         on public.join_requests (task_id, status);
create index if not exists join_requester_idx    on public.join_requests (requester_id);
create index if not exists messages_task_idx     on public.messages (task_id, created_at);
create index if not exists messages_task_type_idx on public.messages (task_id, type, created_at);
create index if not exists reviews_reviewee_idx  on public.reviews (reviewee_id);
create index if not exists profile_media_profile_created_idx
  on public.profile_media (profile_id, created_at desc);

-- ============================================================
-- HELPERS
-- ============================================================

-- Is the current user the host of this task, or an accepted participant?
-- SECURITY DEFINER so it can read join_requests without recursive RLS.
create or replace function public.is_task_participant(p_task uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
           select 1 from public.tasks t
           where t.id = p_task and t.host_id = auth.uid()
         )
      or exists (
           select 1 from public.join_requests j
           where j.task_id = p_task
             and j.requester_id = auth.uid()
             and j.status = 'accepted'
         );
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Keep tasks.spots_filled and tasks.status in sync with accepted joins.
-- This is the denormalised counter done correctly: maintained atomically in
-- the database, so the client never has to count anything.
create or replace function public.sync_task_spots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task     uuid;
  v_accepted int;
  v_needed   int;
  v_status   text;
begin
  -- NEW is not assigned on DELETE, so never touch it there.
  if tg_op = 'DELETE' then
    v_task := old.task_id;
  else
    v_task := new.task_id;
  end if;

  select count(*) into v_accepted
  from public.join_requests
  where task_id = v_task and status = 'accepted';

  select spots_needed, status into v_needed, v_status
  from public.tasks where id = v_task;

  update public.tasks
     set spots_filled = v_accepted,
         status = case
                    when v_status in ('completed','cancelled') then v_status
                    when v_accepted >= v_needed then 'full'
                    else 'open'
                  end
   where id = v_task;

  return null;
end;
$$;

drop trigger if exists trg_sync_task_spots on public.join_requests;
create trigger trg_sync_task_spots
after insert or update of status or delete on public.join_requests
for each row execute function public.sync_task_spots();

-- Users must not be able to promote themselves.
-- RLS cannot restrict columns, so guard the privileged ones here.
-- Covers INSERT too, otherwise a new user could sign up already "verified".
create or replace function public.guard_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Only clamp when a real user is inserting their own row. The service role
    -- (auth.uid() is null) may seed demo data with real numbers.
    if auth.uid() = new.id then
      new.verification_status := 'unverified';
      new.trust_score         := 0;
      new.tasks_completed     := 0;
      new.no_shows            := 0;
    end if;
    return new;
  end if;

  -- pg_trigger_depth() = 1 means a client did this directly.
  -- Depth 2 means one of our own triggers did it (crediting a completed task,
  -- recomputing trust) and that is legitimate, so let it through.
  if auth.uid() = old.id and pg_trigger_depth() = 1 then
    new.verification_status := old.verification_status;
    new.trust_score         := old.trust_score;
    new.tasks_completed     := old.tasks_completed;
    new.no_shows            := old.no_shows;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_fields on public.profiles;
create trigger trg_guard_profile_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_fields();

-- When a task is marked completed, credit everyone who showed up.
create or replace function public.on_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.profiles
       set tasks_completed = tasks_completed + 1
     where id = new.host_id;

    update public.profiles p
       set tasks_completed = p.tasks_completed + 1
      from public.join_requests j
     where j.task_id = new.id
       and j.status = 'accepted'
       and p.id = j.requester_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_task_completed on public.tasks;
create trigger trg_on_task_completed
after update of status on public.tasks
for each row execute function public.on_task_completed();

-- A host may edit their own task, but they must not be able to fake the numbers,
-- hand themselves a sponsor badge, or reassign ownership.
create or replace function public.guard_task_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() = new.host_id then
      -- Take the host name from the profile, never from the browser.
      select display_name, avatar_url
        into new.host_name, new.host_avatar_url
      from public.profiles where id = new.host_id;

      new.spots_filled    := 0;
      new.status          := 'open';
      new.is_sponsored    := false;
      new.sponsor_name    := null;
      new.sponsored_until := null;
    end if;
    return new;
  end if;

  select count(*) into v_accepted
  from public.join_requests
  where task_id = new.id and status = 'accepted';

  new.spots_filled := v_accepted;   -- always derived, never client-supplied
  new.host_id      := old.host_id;  -- ownership cannot be transferred
  new.created_at   := old.created_at;

  if auth.uid() = old.host_id and pg_trigger_depth() = 1 then
    new.is_sponsored    := old.is_sponsored;
    new.sponsor_name    := old.sponsor_name;
    new.sponsored_until := old.sponsored_until;
    new.fill_mode       := old.fill_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_task_fields on public.tasks;
create trigger trg_guard_task_fields
before insert or update on public.tasks
for each row execute function public.guard_task_fields();

-- RLS cannot restrict columns, so a requester updating their own request could
-- otherwise just set status = 'accepted' and let themselves in.
create or replace function public.guard_join_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_needed int;
  v_task_status text;
  v_accepted int;
begin
  if tg_op = 'INSERT' then
    select host_id, spots_needed, status
      into v_host, v_needed, v_task_status
      from public.tasks
     where id = new.task_id
     for update;

    if not found then
      raise exception 'Activity not found';
    end if;

    if auth.uid() is not null then
      if auth.uid() <> new.requester_id or auth.uid() = v_host then
        raise exception 'You can only request to join as yourself';
      end if;
      if v_task_status <> 'open' then
        raise exception 'This activity is no longer accepting requests';
      end if;
      new.status := 'pending';
    end if;
    return new;
  end if;

  select host_id, spots_needed, status
    into v_host, v_needed, v_task_status
    from public.tasks
   where id = old.task_id
   for update;

  new.task_id      := old.task_id;
  new.requester_id := old.requester_id;
  new.created_at   := old.created_at;

  if auth.uid() = v_host then
    if new.status not in ('accepted', 'declined', 'pending', 'waitlisted') then
      new.status := old.status;
    elsif new.status = 'accepted' and old.status <> 'accepted' then
      if old.status = 'withdrawn' or v_task_status not in ('open', 'full') then
        raise exception 'This application can no longer be accepted';
      end if;

      select count(*) into v_accepted
        from public.join_requests
       where task_id = old.task_id
         and status = 'accepted';
      if v_accepted >= v_needed then
        raise exception 'No spots are available for this activity';
      end if;
    end if;
  elsif auth.uid() = old.requester_id then
    if new.status = 'withdrawn' and old.status in ('pending', 'waitlisted', 'accepted') then
      null;
    elsif new.status = 'pending'
      and old.status in ('declined', 'withdrawn')
      and v_task_status = 'open' then
      null;
    else
      new.status := old.status;
    end if;
  else
    new.status := old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_join_status on public.join_requests;
create trigger trg_guard_join_status
before insert or update on public.join_requests
for each row execute function public.guard_join_status();

-- Recompute a user's trust score from reviews + history.
-- rating average * 20  (so a 5.0 is 100)  +  2 per completed task, capped at 100.
create or replace function public.recalc_trust(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg      numeric;
  v_done     int;
  v_new      int;
  v_existing int;
begin
  select coalesce(avg(rating), 0) into v_avg
  from public.reviews where reviewee_id = p_user;

  select tasks_completed into v_done from public.profiles where id = p_user;
  if v_done is null then return; end if;

  v_new := least(100, round(v_avg * 20)::int + v_done * 2);
  -- never let a new review lower a score
  select trust_score into v_existing from public.profiles where id = p_user;
  if v_new > coalesce(v_existing, 0) then
    update public.profiles set trust_score = v_new where id = p_user;
  end if;
end;
$$;

create or replace function public.on_review_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_trust(new.reviewee_id);
  return new;
end;
$$;

drop trigger if exists trg_on_review_created on public.reviews;
create trigger trg_on_review_created
after insert on public.reviews
for each row execute function public.on_review_created();

create or replace function public.guard_profile_media_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_count integer;
begin
  if auth.uid() is not null and auth.uid() <> new.profile_id then
    raise exception 'You can only publish media on your own profile';
  end if;

  if new.media_type = 'image' and new.storage_path !~ (
    '^' || new.profile_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
  ) then
    raise exception 'Invalid profile image storage path';
  end if;
  if new.media_type = 'video' and new.storage_path !~ (
    '^' || new.profile_id::text || '/[0-9a-fA-F-]{36}\.(mp4|webm|mov)$'
  ) then
    raise exception 'Invalid profile media storage path';
  end if;

  perform 1
    from public.profiles
   where id = new.profile_id
   for update;

  select count(*) into v_item_count
    from public.profile_media
   where profile_id = new.profile_id;

  if v_item_count >= 6 then
    raise exception 'A profile can have up to 6 public media items';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_media_insert on public.profile_media;
create trigger trg_guard_profile_media_insert
before insert on public.profile_media
for each row execute function public.guard_profile_media_insert();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.join_requests  enable row level security;
alter table public.messages       enable row level security;
alter table public.reviews        enable row level security;
alter table public.reports        enable row level security;
alter table public.account_posting_controls enable row level security;
alter table public.verifications  enable row level security;
alter table public.profile_media  enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (true);          -- names and avatars appear on public task cards

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Only items deliberately added to the public profile gallery are exposed.
drop policy if exists profile_media_public_read on public.profile_media;
create policy profile_media_public_read on public.profile_media
  for select using (true);

drop policy if exists profile_media_insert_own on public.profile_media;
create policy profile_media_insert_own on public.profile_media
  for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists profile_media_delete_own on public.profile_media;
create policy profile_media_delete_own on public.profile_media
  for delete to authenticated
  using (auth.uid() = profile_id);
grant select on public.profile_media to anon, authenticated;
grant insert, delete on public.profile_media to authenticated;
revoke update on public.profile_media from anon, authenticated;

-- ---------- tasks ----------
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select using (true);          -- PUBLIC: this is the no-login Discover feed

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

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete using (auth.uid() = host_id);

-- ---------- join_requests ----------
-- The requester sees their own; the host sees requests on their tasks.
-- Nobody else sees anything.
drop policy if exists join_read on public.join_requests;
create policy join_read on public.join_requests
  for select using (
    auth.uid() = requester_id
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.host_id = auth.uid()
    )
    or (
      status = 'accepted'
      and public.is_task_participant(task_id)
    )
  );

drop policy if exists join_insert_own on public.join_requests;
create policy join_insert_own on public.join_requests
  for insert with check (
    auth.uid() = requester_id
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.status = 'open'
        and t.host_id <> auth.uid()
    )
  );

-- Host accepts/declines; requester may withdraw their own.
drop policy if exists join_update on public.join_requests;
create policy join_update on public.join_requests
  for update using (
    auth.uid() = requester_id
    or exists (select 1 from public.tasks t where t.id = task_id and t.host_id = auth.uid())
  );

drop policy if exists join_delete on public.join_requests;
create policy join_delete on public.join_requests
  for delete using (
    auth.uid() = requester_id
    or exists (select 1 from public.tasks t where t.id = task_id and t.host_id = auth.uid())
  );

-- ---------- messages ----------
-- THE IMPORTANT ONE. Only the host and accepted participants can read or write.
-- This is the guarantee Base44 could not give you.
drop policy if exists messages_read_participants on public.messages;
create policy messages_read_participants on public.messages
  for select using (public.is_task_participant(task_id));

drop policy if exists messages_insert_participants on public.messages;
create policy messages_insert_participants on public.messages
  for insert with check (
    auth.uid() = sender_id and public.is_task_participant(task_id)
  );

drop policy if exists messages_delete_own on public.messages;

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update
  using (auth.uid() = sender_id and public.is_task_participant(task_id))
  with check (auth.uid() = sender_id and public.is_task_participant(task_id));

-- ---------- reviews ----------
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select using (true);

-- You may review only people you actually did the task with.
drop policy if exists reviews_insert_participant on public.reviews;
create policy reviews_insert_participant on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and public.is_task_participant(task_id)
    and exists (
      select 1 from public.tasks t where t.id = task_id and t.status = 'completed'
    )
    and (
      exists (select 1 from public.tasks t where t.id = task_id and t.host_id = reviewee_id)
      or exists (
        select 1 from public.join_requests j
        where j.task_id = task_id and j.requester_id = reviewee_id and j.status = 'accepted'
      )
    )
  );

-- ---------- reports ----------
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert with check (auth.uid() = reporter_id);

-- No select policy: only the service role (admin dashboard) can read reports.

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

-- ---------- verifications ----------
drop policy if exists verifications_read_own on public.verifications;
create policy verifications_read_own on public.verifications
  for select using (auth.uid() = user_id);

drop policy if exists verifications_insert_own on public.verifications;
create policy verifications_insert_own on public.verifications
  for insert with check (auth.uid() = user_id);

-- No update policy: approving verification requires the service role.

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('verifications', 'verifications', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  31457280,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_media_storage_public_read on storage.objects;
create policy profile_media_storage_public_read on storage.objects
  for select using (bucket_id = 'profile-media');

drop policy if exists profile_media_storage_insert_own on storage.objects;
create policy profile_media_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_media_storage_delete_own on storage.objects;
create policy profile_media_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
        'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_auth_write on storage.objects;
create policy avatars_auth_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists verifications_own on storage.objects;
create policy verifications_own on storage.objects
  for select using (
    bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verifications_own_write on storage.objects;
create policy verifications_own_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

drop policy if exists chat_media_select on storage.objects;
create policy chat_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    )
  then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    )
  then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end
$$;
