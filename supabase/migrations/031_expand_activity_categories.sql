-- ============================================================
-- Come w' me — Widen activity categories (v031)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================
-- The app now offers ~26 categories instead of 8. Existing rows keep
-- their values; this only re-opens the CHECK constraint.

alter table public.tasks
  drop constraint if exists tasks_category_check;

alter table public.tasks
  add constraint tasks_category_check
  check (category in (
    'market_run', 'ride', 'food', 'study', 'dev', 'event', 'errands', 'other',
    'movies', 'sports', 'gym', 'outdoors', 'music', 'arts', 'fashion',
    'faith', 'volunteer', 'pets', 'wellness', 'gaming', 'travel',
    'nightlife', 'shopping', 'social', 'health', 'repair'
  ));
