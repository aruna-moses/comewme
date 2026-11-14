create table if not exists public.chat_read_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.chat_read_states enable row level security;

drop policy if exists chat_read_states_select_own on public.chat_read_states;
create policy chat_read_states_select_own on public.chat_read_states
  for select to authenticated using (
    auth.uid() = user_id and public.is_task_participant(task_id)
  );

grant select on public.chat_read_states to authenticated;
revoke insert, update, delete on public.chat_read_states from anon, authenticated;

insert into public.chat_read_states (user_id, task_id, last_read_at)
select t.host_id, t.id, now()
from public.tasks t
union
select jr.requester_id, jr.task_id, now()
from public.join_requests jr
where jr.status = 'accepted'
on conflict (user_id, task_id) do nothing;

create or replace function public.initialize_task_host_chat_read_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_read_states (user_id, task_id, last_read_at)
  values (new.host_id, new.id, now())
  on conflict (user_id, task_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_initialize_task_host_chat_read_state on public.tasks;
create trigger trg_initialize_task_host_chat_read_state
after insert on public.tasks
for each row execute function public.initialize_task_host_chat_read_state();

create or replace function public.initialize_joined_member_chat_read_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and tg_op = 'INSERT' then
    insert into public.chat_read_states (user_id, task_id, last_read_at)
    values (new.requester_id, new.task_id, now())
    on conflict (user_id, task_id)
    do update set last_read_at = excluded.last_read_at;
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.chat_read_states (user_id, task_id, last_read_at)
    values (new.requester_id, new.task_id, now())
    on conflict (user_id, task_id)
    do update set last_read_at = excluded.last_read_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_initialize_joined_member_chat_read_state on public.join_requests;
create trigger trg_initialize_joined_member_chat_read_state
after insert or update of status on public.join_requests
for each row execute function public.initialize_joined_member_chat_read_state();

create or replace function public.mark_chat_read(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_task_participant(p_task_id) then
    raise exception 'You must be a member of this activity to mark its chat as read';
  end if;

  insert into public.chat_read_states (user_id, task_id, last_read_at)
  values (auth.uid(), p_task_id, now())
  on conflict (user_id, task_id)
  do update set last_read_at = greatest(public.chat_read_states.last_read_at, excluded.last_read_at);
end;
$$;

create or replace function public.get_notification_badge_counts()
returns table (pending_applications bigint, unread_messages bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    (
      select count(*)
      from public.join_requests jr
      join public.tasks t on t.id = jr.task_id
      where t.host_id = auth.uid()
        and t.status in ('open', 'full')
        and jr.status = 'pending'
    ),
    (
      select count(*)
      from public.messages m
      where m.sender_id <> auth.uid()
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
    )
  where auth.uid() is not null;
$$;

create or replace function public.get_chat_unread_counts()
returns table (task_id uuid, unread_messages bigint)
language sql
security definer
stable
set search_path = public
as $$
  select m.task_id, count(*)
  from public.messages m
  where auth.uid() is not null
    and m.sender_id <> auth.uid()
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

revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.get_notification_badge_counts() from public, anon;
revoke all on function public.get_chat_unread_counts() from public, anon;
revoke all on function public.initialize_task_host_chat_read_state() from public, anon;
revoke all on function public.initialize_joined_member_chat_read_state() from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.get_notification_badge_counts() to authenticated;
grant execute on function public.get_chat_unread_counts() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'join_requests'
    ) then
      alter publication supabase_realtime add table public.join_requests;
    end if;
  end if;
end
$$;
