-- ============================================================
-- Come w' me — fix expired-cancellation cleanup (v058)
-- Run in Supabase SQL Editor -> New query -> Run
-- Supabase forbids direct DML on storage.objects from SQL, so media removal
-- moved to the client Storage API. This RPC now only removes DB rows.
-- ============================================================

create or replace function public.cleanup_expired_cancellations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_count integer := 0;
begin
  for v_task in
    select id
    from public.tasks
    where status = 'cancelled'
      and cancelled_at is not null
      and now() > cancelled_at + interval '30 minutes'
  loop
    delete from public.notifications
     where link_path = '/task/' || v_task.id::text
        or link_path like '/task/' || v_task.id::text || '/%';

    delete from public.tasks where id = v_task.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.cleanup_expired_cancellations() from public, anon;
grant execute on function public.cleanup_expired_cancellations() to authenticated;
