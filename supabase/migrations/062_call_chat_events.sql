-- ============================================================
-- Come w' me — call activity in chat timeline (v062)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

alter table public.activity_system_events
  drop constraint if exists activity_system_events_event_type_check;
alter table public.activity_system_events
  add constraint activity_system_events_event_type_check
  check (event_type in (
    'joined','left','on_my_way','arrived','completed','recap',
    'call_started','call_ended'
  ));
