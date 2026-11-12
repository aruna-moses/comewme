-- ============================================================
-- Come w' me — Push tokens for off-app notifications (v033)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.user_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  device_type text not null default 'unknown',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.user_push_tokens enable row level security;

-- Members manage only their own devices/tokens.
drop policy if exists push_tokens_read_own on public.user_push_tokens;
create policy push_tokens_read_own on public.user_push_tokens
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists push_tokens_insert_own on public.user_push_tokens;
create policy push_tokens_insert_own on public.user_push_tokens
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists push_tokens_update_own on public.user_push_tokens;
create policy push_tokens_update_own on public.user_push_tokens
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_tokens_delete_own on public.user_push_tokens;
create policy push_tokens_delete_own on public.user_push_tokens
  for delete to authenticated
  using (auth.uid() = user_id);

-- Edge functions (service role) read everything to dispatch notifications.
grant select, insert, update, delete on public.user_push_tokens to service_role;

create index if not exists user_push_tokens_user_idx on public.user_push_tokens (user_id);
