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

drop policy if exists messages_delete_own on public.messages;

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update
  using (auth.uid() = sender_id and public.is_task_participant(task_id))
  with check (auth.uid() = sender_id and public.is_task_participant(task_id));
