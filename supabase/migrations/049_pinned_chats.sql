-- Per-user pin of activity group chats (sender-only control).
-- Pinned chats always float to the top of the chat list regardless of activity.
-- Syncs across devices via server-side table + RLS (same pattern as muted_chats).

create table if not exists public.pinned_chats (
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  pinned_at  timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.pinned_chats enable row level security;

drop policy if exists pinned_chats_read_own on public.pinned_chats;
create policy pinned_chats_read_own on public.pinned_chats
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists pinned_chats_write_own on public.pinned_chats;
create policy pinned_chats_write_own on public.pinned_chats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.pin_chat(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.pinned_chats (user_id, task_id) values (auth.uid(), p_task_id)
  on conflict (user_id, task_id) do nothing;
end;
$$;

create or replace function public.unpin_chat(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.pinned_chats where user_id = auth.uid() and task_id = p_task_id;
end;
$$;

revoke all on function public.pin_chat(uuid) from public, anon;
revoke all on function public.unpin_chat(uuid) from public, anon;
grant execute on function public.pin_chat(uuid) to authenticated;
grant execute on function public.unpin_chat(uuid) to authenticated;
