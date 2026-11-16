-- ============================================================
-- Come w' me — Ad review notifications (v052)
-- Run in Supabase SQL Editor -> New query -> Run
-- Depends on 013 (advertisements) and 021 (notifications / push_notification).
-- ============================================================

-- When a moderator approves, rejects or pauses an ad, tell the advertiser in
-- the app. The notification links to their ads page, where the note from review
-- and the run dates live.
create or replace function public.notify_ad_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand text := coalesce(nullif(new.brand_name, ''), 'Your ad');
  v_title text;
  v_body  text;
begin
  if new.advertiser_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_title := 'Your ad is approved';
    v_body  := v_brand || ' runs from ' || to_char(new.start_date, 'DD Mon')
               || ' to ' || to_char(new.end_date, 'DD Mon')
               || '. We will send payment details on WhatsApp.';
  elsif new.status = 'rejected' then
    v_title := 'Your ad needs changes';
    v_body  := v_brand || ' was not approved.'
               || case
                    when new.admin_note is not null and length(trim(new.admin_note)) > 0
                      then ' Note: ' || new.admin_note
                    else ''
                  end;
  elsif new.status = 'paused' then
    v_title := 'Your ad is paused';
    v_body  := v_brand || ' has stopped showing on Discover.'
               || case
                    when new.admin_note is not null and length(trim(new.admin_note)) > 0
                      then ' Note: ' || new.admin_note
                    else ''
                  end;
  else
    return new;
  end if;

  perform public.push_notification(
    new.advertiser_id,
    'info',
    v_title,
    v_body,
    '/advertise/campaigns'
  );
  return new;
end;
$$;

drop trigger if exists advertisements_review_notify on public.advertisements;
create trigger advertisements_review_notify
  after update of status on public.advertisements
  for each row
  execute function public.notify_ad_review();
