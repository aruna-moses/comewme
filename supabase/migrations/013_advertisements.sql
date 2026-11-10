-- ============================================================
-- Come w' me — Advertisements (v13)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.advertisements (
  id              uuid primary key default gen_random_uuid(),
  advertiser_id   uuid references auth.users(id) on delete set null,
  brand_name      text not null,
  headline        text not null,
  cta_text        text not null default 'Learn more',
  destination_url text not null,
  image_url       text,
  brand_color     text not null default '#FF9F1C',
  start_date      date not null,
  end_date        date not null,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','paused')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id) on delete set null,
  constraint advertisements_date_order check (end_date >= start_date)
);

alter table public.advertisements enable row level security;

-- Anyone (even logged out) can see ads that are live right now
drop policy if exists ads_read_live on public.advertisements;
create policy ads_read_live on public.advertisements
  for select using (
    status = 'approved'
    and start_date <= current_date
    and end_date >= current_date
  );

-- Advertisers can see their own submissions at any status
drop policy if exists ads_read_own on public.advertisements;
create policy ads_read_own on public.advertisements
  for select to authenticated using (auth.uid() = advertiser_id);

-- Moderators can see everything
drop policy if exists ads_read_moderator on public.advertisements;
create policy ads_read_moderator on public.advertisements
  for select to authenticated using (public.is_moderator());

-- Advertisers may only create pending ads for themselves
drop policy if exists ads_insert_own on public.advertisements;
create policy ads_insert_own on public.advertisements
  for insert to authenticated
  with check (auth.uid() = advertiser_id and status = 'pending');

-- Only moderators can approve / reject / pause
drop policy if exists ads_update_moderator on public.advertisements;
create policy ads_update_moderator on public.advertisements
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Advertisers can pull back a submission that has not been reviewed yet
drop policy if exists ads_delete_own_pending on public.advertisements;
create policy ads_delete_own_pending on public.advertisements
  for delete to authenticated
  using (auth.uid() = advertiser_id and status = 'pending');

create index if not exists advertisements_live_idx
  on public.advertisements (status, start_date, end_date);
create index if not exists advertisements_advertiser_idx
  on public.advertisements (advertiser_id);

-- Public bucket for ad creative
insert into storage.buckets (id, name, public)
values ('ad-media', 'ad-media', true)
on conflict (id) do nothing;

drop policy if exists ad_media_insert on storage.objects;
create policy ad_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ad-media');

drop policy if exists ad_media_select on storage.objects;
create policy ad_media_select on storage.objects
  for select using (bucket_id = 'ad-media');

drop policy if exists ad_media_delete_own on storage.objects;
create policy ad_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'ad-media' and owner::text = auth.uid()::text);
