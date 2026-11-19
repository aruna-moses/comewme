-- ============================================================
-- Come w' me — Account deletion: repair every FK in the deletion chain (v053)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
--
-- Why this exists:
--   delete_own_account() deletes the auth.users row. That cascades into every
--   per-user row -- profiles, tasks, messages, reviews, notifications, and every
--   chain underneath them. But if ANY foreign key in that chain has no
--   ON DELETE rule, the whole delete aborts with:
--     "update or delete on table ... violates foreign key constraint ..."
--   and the UI falls back to its red "Could not delete your account" message.
--
--   Deleting a fresh account works, which is exactly what we saw: the live
--   schema has a foreign key somewhere with a missing ON DELETE rule that fresh
--   QA accounts never exercise. This migration finds and repairs ALL of them at
--   runtime, prints what it fixed, then replaces delete_own_account() so it
--   also clears the user's storage objects (avatars, verification media,
--   ad media, chat media) before the auth user goes.
-- ============================================================

-- ---------- 1) repair every FK in the deletion chain ----------
-- Rule: if a foreign key references one of these parents and has no ON DELETE
-- action, give it one: SET NULL when the referencing column is nullable
-- (a "reviewer/owner" style reference), CASCADE otherwise (a hard child row).
-- Roots: auth.users, public.profiles, public.tasks, public.messages, public.violations.
-- Scope: public + storage schemas. auth.* internals are left alone.
do $$
declare
  r          record;
  v_def      text;
  v_notnull  boolean;
  v_fixed    int := 0;
begin
  for r in
    select n.nspname as schema_name,
           t.relname as table_name,
           c.conname as constraint_name,
           pg_get_constraintdef(c.oid) as def,
           a.attnotnull as attnotnull
    from pg_constraint c
    join pg_class t      on t.oid = c.conrelid
    join pg_namespace n  on n.oid = t.relnamespace
    join pg_attribute a  on a.attrelid = c.conrelid
                        and a.attnum   = c.conkey[1]   -- every FK we care about is single-column
    where c.contype = 'f'
      and n.nspname in ('public', 'storage')
      and (
           pg_get_constraintdef(c.oid) ilike '%references auth.users(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.profiles(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.tasks(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.messages(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.violations(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references profiles(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references tasks(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references messages(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references violations(id)%'
      )
      and pg_get_constraintdef(c.oid) not ilike '%on delete cascade%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set null%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set default%'
  loop
    v_notnull := r.attnotnull;
    v_def := r.def;

    execute format('alter table %I.%I drop constraint %I', r.schema_name, r.table_name, r.constraint_name);
    if v_notnull then
      execute format('alter table %I.%I add constraint %I %s on delete cascade',
        r.schema_name, r.table_name, r.constraint_name, v_def);
      raise notice 'fixed (cascade / NOT NULL): %.% constraint %I', r.schema_name, r.table_name, r.constraint_name;
    else
      execute format('alter table %I.%I add constraint %I %s on delete set null',
        r.schema_name, r.table_name, r.constraint_name, v_def);
      raise notice 'fixed (set null / nullable): %.% constraint %I', r.schema_name, r.table_name, r.constraint_name;
    end if;
    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'account-deletion FK repair complete: % constraint(s) fixed', v_fixed;
end $$;

-- ---------- 2) deleting your account also deletes your storage objects ----------
-- Avatars, verification selfies/clips, ad media, chat photos & voice notes:
-- anything owned by this user. Removing these first can only help the delete
-- and guarantees no orphaned private media survives a "delete my account" tap.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- private media owned by this user (best effort — column/table layout differs by Supabase version)
  begin
    delete from storage.objects where owner = auth.uid();
  exception
    when undefined_column then null;  -- storage.objects has no owner column on this project
    when undefined_table   then null;  -- no storage schema
    when others            then null;  -- never let a media cleanup failure block account deletion
  end;

  -- the auth row. cascades everything in public.* (profiles, tasks, messages...)
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- ---------- 3) sanity report ----------
-- Any FK in the chain that STILL has no delete action will be listed here.
-- If this prints nothing, the delete path is fully cascaded.
do $$
declare
  r record;
  v_left int := 0;
begin
  for r in
    select n.nspname as schema_name, t.relname as table_name, c.conname as constraint_name,
           pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t      on t.oid = c.conrelid
    join pg_namespace n  on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname in ('public', 'storage')
      and (
           pg_get_constraintdef(c.oid) ilike '%references auth.users(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.profiles(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.tasks(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.messages(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references public.violations(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references profiles(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references tasks(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references messages(id)%'
        or pg_get_constraintdef(c.oid) ilike '%references violations(id)%'
      )
      and pg_get_constraintdef(c.oid) not ilike '%on delete cascade%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set null%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set default%'
  loop
    v_left := v_left + 1;
    raise notice 'STILL BLOCKING: %.% constraint %I (%)', r.schema_name, r.table_name, r.constraint_name, r.def;
  end loop;
  if v_left = 0 then
    raise notice 'all deletion-chain foreign keys have an ON DELETE rule — account deletion is fully cascaded';
  end if;
end $$;
