-- ============================================================
-- Come w' me — Account: change username, delete own account (v032)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- sos_alerts.reviewed_by had no ON DELETE rule, so deleting a moderator's auth row
-- would block on the FK. Give it ON DELETE SET NULL like every other reviewer reference.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'sos_alerts'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%references auth.users(id)%'
  limit 1;

  if v_constraint is not null then
    execute format('alter table public.sos_alerts drop constraint if exists %I', v_constraint);
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'sos_alerts'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%references auth.users(id) on delete set null%'
  ) then
    alter table public.sos_alerts
      add constraint sos_alerts_reviewed_by_fkey
      foreign key (reviewed_by) references auth.users(id) on delete set null;
  end if;
end $$;

-- ---------- change own username ----------
create or replace function public.change_username(p_new text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text := lower(trim(coalesce(p_new, '')));
  v_count  int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if v_handle !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Use 3 to 24 letters, numbers and underscores.';
  end if;

  select count(*) into v_count
  from public.profiles
  where username = v_handle
    and id <> auth.uid();

  if v_count > 0 then
    raise exception 'That username is taken.';
  end if;

  update public.profiles
     set username = v_handle
   where id = auth.uid();
end;
$$;

grant execute on function public.change_username(text) to authenticated;

-- ---------- delete own account ----------
-- Removes the auth user; every per-user row cascades from there.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from auth.users
  where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
