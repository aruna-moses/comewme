-- Chat notifications: accurate media labels, ON TOP of the activity-title fix (v035).
-- Before this migration, a media-only message read "[media]".
-- After: voice notes show length, photos say "Photo", locations say "Location".
-- Title = the activity title (as introduced in 035). Body = "<sender>: <preview>".
--   title: "Friday Kickback"
--   body:  "Aruna: Voice note (0:42)"
--   body:  "Aruna: Photo"
--   body:  "Aruna: Location"
--   body:  "Aruna: see you at 7"

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_caption text;
  v_duration text;
begin
  select title into v_title
  from public.tasks
  where id = new.task_id;

  v_caption := nullif(trim(coalesce(new.body, '')), '');
  v_duration := case
    when new.duration is not null and new.duration > 0
      then lpad(floor(new.duration / 60)::text, 1, '') || ':' || lpad((new.duration % 60)::int::text, 2, '0')
    else null
  end;

  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.user_id,
    'chat',
    left(coalesce(nullif(v_title, ''), 'Activity'), 60),
    left(
      coalesce(new.sender_name, 'Someone') || ': ' ||
      case
        when new.type = 'audio' then
          'Voice note'
          || case when v_duration is null then '' else ' (' || v_duration || ')' end
          || coalesce(' · ' || v_caption, '')
        when new.type = 'image' then
          'Photo' || coalesce(' · ' || v_caption, '')
        when new.body ilike '%My location:%' then
          'Location'
        else coalesce(v_caption, '')
      end,
      160
    ),
    '/task/' || new.task_id || '/chat'
  from (
    select requester_id as user_id
      from public.join_requests
      where task_id = new.task_id and status = 'accepted'
    union
    select host_id from public.tasks where id = new.task_id
  ) p
  where p.user_id <> new.sender_id;

  return new;
end;
$$;
