-- Per-user mute of activity group chats (sender-only control).
-- Blocks push notifications AND in-app toasts; chat remains viewable.
-- Syncs across devices via server-side table + RLS.

create table if not exists public.muted_chats (
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  muted_at   timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.muted_chats enable row level security;

drop policy if exists muted_chats_read_own on public.muted_chats;
create policy muted_chats_read_own on public.muted_chats
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists muted_chats_write_own on public.muted_chats;
create policy muted_chats_write_own on public.muted_chats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.mute_chat(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.muted_chats (user_id, task_id) values (auth.uid(), p_task_id)
  on conflict (user_id, task_id) do nothing;
end;
$$;

create or replace function public.unmute_chat(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.muted_chats where user_id = auth.uid() and task_id = p_task_id;
end;
$$;

revoke all on function public.mute_chat(uuid) from public, anon;
revoke all on function public.unmute_chat(uuid) from public, anon;
grant execute on function public.mute_chat(uuid) to authenticated;
grant execute on function public.unmute_chat(uuid) to authenticated;
