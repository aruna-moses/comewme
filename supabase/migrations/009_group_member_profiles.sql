drop policy if exists join_read on public.join_requests;
create policy join_read on public.join_requests
  for select using (
    auth.uid() = requester_id
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.host_id = auth.uid()
    )
    or (
      status = 'accepted'
      and public.is_task_participant(task_id)
    )
  );
