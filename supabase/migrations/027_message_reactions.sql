-- ============================================================
-- Come w' me — Message reactions (v027)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_read on public.message_reactions;
create policy message_reactions_read on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and (
          -- host or accepted joiners can read reactions in this thread
          exists (
            select 1 from public.tasks t
            where t.id = m.task_id and t.host_id = auth.uid()
          )
          or exists (
            select 1 from public.join_requests j
            where j.task_id = m.task_id and j.requester_id = auth.uid() and j.status = 'accepted'
          )
        )
    )
  );

drop policy if exists message_reactions_insert_own on public.message_reactions;
create policy message_reactions_insert_own on public.message_reactions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists message_reactions_delete_own on public.message_reactions;
create policy message_reactions_delete_own on public.message_reactions
  for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
