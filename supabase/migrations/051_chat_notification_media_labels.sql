-- Accurate media labels in chat push + in-app notification previews.
-- Before: any media-only message collapsed to the literal string '[media]'.
-- After: every message previews truthfully —
--   Voice note (0:42)            — voice note with no caption
--   Voice note (0:42) · caption  — voice note with a caption
--   Photo                        — image, no caption
--   Photo · caption              — image with a caption
--   Location                     — shared location
--   <actual text>                — plain text

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caption text;
  v_duration text;
begin
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
    coalesce(new.sender_name, 'Someone') || ' sent a message',
    left(
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
