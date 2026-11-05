-- Record completion of the community safety check.
alter table public.profiles
  add column if not exists community_check_passed_at timestamptz;
