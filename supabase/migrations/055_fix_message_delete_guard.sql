-- ============================================================
-- Come w' me — Let account deletion through the message guard (v055)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
--
-- THE BUG THIS FIXES:
--   messages.reply_to_sender_id has ON DELETE SET NULL. When a member who was
--   replied to is deleted, Postgres clears that field on OTHER members' messages
--   -- that is an UPDATE. trg_guard_message_soft_delete is a BEFORE UPDATE
--   trigger that treats every UPDATE as a soft delete and raises
--     "You can only delete your own messages while you are a group member"
--   because the message belongs to someone else.
--
--   So an account whose messages were replied to could never be deleted, while
--   a fresh account with no replies deleted fine. Exactly the reported symptom.
--
-- THE FIX:
--   The guard only applies to actual soft deletes. An UPDATE that does not
--   touch deleted_at (the cascade clearing a reply preview, or any other
--   ordinary update) passes straight through. Soft-delete protection and its
--   "Messages can only be deleted" rule are unchanged.
-- ============================================================

create or replace function public.guard_message_soft_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Not a soft delete: let it through. In particular this is the UPDATE caused
  -- by ON DELETE SET NULL on messages.reply_to_sender_id when the member who
  -- was replied to deletes their account -- that update hits someone else's
  -- message, so the ownership check below must not run for it.
  if old.deleted_at is null and new.deleted_at is null then
    return new;
  end if;

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
