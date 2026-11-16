-- Realtime "my messages got quoted" badge, grouped per chat.
-- Mirrors get_chat_unread_counts(): same last_read_at gate per chat_read_states row,
-- but counts messages that quote one of the current user's messages.
-- The existing Database Webhook on `messages` INSERTs already pulls
-- NotificationContext into refresh(), so the badge updates live.

create or replace function public.get_my_quote_counts()
returns table (task_id uuid, quote_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select m.task_id, count(*)
  from public.messages m
  where auth.uid() is not null
    and m.reply_to_sender_id = auth.uid()
    and m.deleted_at is null
    and public.is_task_participant(m.task_id)
    and m.created_at > coalesce(
      (
        select s.last_read_at
        from public.chat_read_states s
        where s.user_id = auth.uid()
          and s.task_id = m.task_id
      ),
      '-infinity'::timestamptz
    )
  group by m.task_id;
$$;

revoke all on function public.get_my_quote_counts() from public, anon;
grant execute on function public.get_my_quote_counts() to authenticated;
