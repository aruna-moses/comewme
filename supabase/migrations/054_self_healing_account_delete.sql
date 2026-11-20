-- ============================================================
-- Come w' me — Self-healing account deletion (v054)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
--
-- This is deliberately ONE statement (a single DO block). Some editors run
-- "the statement under the cursor" or "the current selection"; with the whole
-- migration inside one statement there is nothing to run but all of it.
--
-- Why this exists (v053 wasn't enough):
--   v053 tried to repair, once, a handful of foreign keys it *guessed* could
--   block a delete. That only works for constraints that existed at the moment
--   it ran, in the five parent tables it listed, with the exact wording it
--   matched. Any other reference -- a reviewer/owner column, a table added by a
--   later migration, a constraint created by hand in the dashboard, a chain that
--   hangs off a parent it never listed -- still aborts the delete with
--     "update or delete on table ... violates foreign key constraint ..."
--   which is why some accounts delete and others (the ones that actually used
--   the app) do not.
--
--   Guessing again would fail again. So instead the delete now asks Postgres
--   exactly which constraint blocked it, repairs that one constraint, and
--   retries -- repeating until the delete goes through. Only constraints that
--   genuinely blocked a real account deletion are ever touched, and every one of
--   them is logged in public.account_delete_repairs so you can see afterwards
--   which reference was holding which account back.
--
--   Repair rule: SET NULL when every referencing column is nullable (a
--   "reviewed_by" / "owner" style pointer that should survive), CASCADE
--   otherwise (a row that belongs to the person and must go with them).
-- ============================================================

do $migration$
declare
  r      record;
  v_note text;
begin
  -- ---------- 1) where the repairs are recorded ----------
  -- RLS on, no policies: readable from the SQL editor (postgres), never from
  -- the app. This is the answer to "why couldn't that account be deleted?".
  execute $ddl$
    create table if not exists public.account_delete_repairs (
      id              bigint generated always as identity primary key,
      repaired_at     timestamptz not null default now(),
      table_schema    text not null,
      table_name      text not null,
      constraint_name text not null,
      new_action      text not null,
      previous_def    text
    )
  $ddl$;

  execute $ddl$ alter table public.account_delete_repairs enable row level security $ddl$;

  -- ---------- 2) repair exactly one blocking constraint ----------
  execute $ddl$
    create or replace function public.repair_delete_blocker(
      p_schema       text,
      p_table        text,
      p_constraint   text,
      p_force_action text default null
    )
    returns text
    language plpgsql
    security definer
    set search_path = pg_catalog, public, storage
    as $fn$
    declare
      v_pass          int;
      v_oid           oid;
      v_schema        text;
      v_table         text;
      v_ref_schema    text;
      v_ref_table     text;
      v_old_def       text;
      v_cols          text;
      v_ref_cols      text;
      v_all_nullable  boolean;
      v_action        text;
      v_new_def       text;
    begin
      if p_constraint is null then
        raise exception 'repair_delete_blocker: no constraint name given';
      end if;

      -- Pass 1: the exact table Postgres reported. Pass 2: fall back to the name
      -- alone (Postgres names the parent table in some delete violations, not
      -- the child that actually holds the constraint).
      for v_pass in 1..2 loop
        select c.oid, n.nspname, t.relname, rn.nspname, rt.relname,
               pg_get_constraintdef(c.oid)
          into v_oid, v_schema, v_table, v_ref_schema, v_ref_table, v_old_def
        from pg_constraint c
        join pg_class t      on t.oid = c.conrelid
        join pg_namespace n  on n.oid = t.relnamespace
        join pg_class rt     on rt.oid = c.confrelid
        join pg_namespace rn on rn.oid = rt.relnamespace
        where c.contype = 'f'
          and c.conname = p_constraint
          and n.nspname in ('public', 'storage')
          and (
            v_pass = 2
            or (
              (p_schema is null or n.nspname = p_schema)
              and (p_table is null or t.relname = p_table)
            )
          )
        order by (n.nspname = 'public') desc, c.oid
        limit 1;

        exit when v_oid is not null;
      end loop;

      if v_oid is null then
        raise exception 'Blocking constraint % was not found in public/storage', p_constraint;
      end if;

      -- Referencing columns, referenced columns, and whether the rule can be
      -- SET NULL (allowed only if every referencing column accepts NULL).
      select string_agg(quote_ident(a.attname), ', ' order by k.ord),
             string_agg(quote_ident(ra.attname), ', ' order by k.ord),
             bool_and(not a.attnotnull)
        into v_cols, v_ref_cols, v_all_nullable
      from pg_constraint c
      cross join lateral unnest(c.conkey)  with ordinality as k(attnum, ord)
      cross join lateral unnest(c.confkey) with ordinality as rk(attnum, ord)
      join pg_attribute a  on a.attrelid  = c.conrelid  and a.attnum  = k.attnum
      join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = rk.attnum
      where c.oid = v_oid
        and k.ord = rk.ord;

      v_action  := coalesce(
        p_force_action,
        case when coalesce(v_all_nullable, false) then 'set null' else 'cascade' end
      );
      v_new_def := format(
        'foreign key (%s) references %I.%I (%s) on delete %s',
        v_cols, v_ref_schema, v_ref_table, v_ref_cols, v_action
      );

      execute format('alter table %I.%I drop constraint %I', v_schema, v_table, p_constraint);

      begin
        execute format('alter table %I.%I add constraint %I %s',
                       v_schema, v_table, p_constraint, v_new_def);
      exception
        when others then
          -- Pre-existing orphan rows can block validation. The delete rule
          -- still works on NOT VALID constraints, so keep it instead of failing.
          execute format('alter table %I.%I add constraint %I %s not valid',
                         v_schema, v_table, p_constraint, v_new_def);
          v_new_def := v_new_def || ' not valid';
      end;

      insert into public.account_delete_repairs
        (table_schema, table_name, constraint_name, new_action, previous_def)
      values
        (v_schema, v_table, p_constraint, v_action, v_old_def);

      return format('%I.%I %I -> on delete %s', v_schema, v_table, p_constraint, v_action);
    end
    $fn$
  $ddl$;

  -- Internal helper only: the delete function (same owner) calls it.
  execute $ddl$ revoke all on function public.repair_delete_blocker(text, text, text, text) from public $ddl$;

  -- ---------- 3) fix, up front, every reference that points straight at auth.users ----------
  -- No account can ever be deleted while such a reference has no delete rule,
  -- so settle these now. Whatever is found lands in account_delete_repairs.
  for r in
    select n.nspname as schema_name, t.relname as table_name, c.conname as constraint_name
    from pg_constraint c
    join pg_class t     on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname in ('public', 'storage')
      and c.confrelid = 'auth.users'::regclass
      and pg_get_constraintdef(c.oid) not ilike '%on delete cascade%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set null%'
      and pg_get_constraintdef(c.oid) not ilike '%on delete set default%'
  loop
    v_note := public.repair_delete_blocker(r.schema_name, r.table_name, r.constraint_name);
    raise notice 'account delete: %', v_note;
  end loop;

  -- ---------- 4) delete my account: clean media, then delete, self-healing ----------
  execute $ddl$
    create or replace function public.delete_own_account()
    returns void
    language plpgsql
    security definer
    set search_path = public, storage
    as $body$
    declare
      v_uid        uuid := auth.uid();
      v_attempt    int := 0;
      r            record;
      v_schema     text;
      v_table      text;
      v_constraint text;
      v_last       text;
      v_note       text;
      v_tasks      uuid[];
    begin
      if v_uid is null then
        raise exception 'Not signed in';
      end if;

      -- A real account touches a lot of rows. Give the statement room instead
      -- of dying halfway through and leaving a confusing error.
      begin
        perform set_config('statement_timeout', '60000', true);
        perform set_config('lock_timeout', '10000', true);
      exception when others then
        null;
      end;

      -- 1) media owned by this person: avatars, verification selfies, ad images,
      --    chat photos and voice notes (private buckets and public ones).
      begin
        delete from storage.objects where owner = v_uid;
      exception when others then
        raise notice 'account delete: owner media cleanup skipped: %', sqlerrm;
      end;

      begin
        delete from storage.objects
         where name like v_uid::text || '/%'
            or name like 'sos/' || v_uid::text || '/%';
      exception when others then
        raise notice 'account delete: path media cleanup skipped: %', sqlerrm;
      end;

      -- 2) chat media for activities this person hosted -- the whole group chat
      --    disappears with them, so its files must go too.
      begin
        select array_agg(id) into v_tasks from public.tasks where host_id = v_uid;
        if v_tasks is not null and cardinality(v_tasks) > 0 then
          delete from storage.objects
           where name like any (
             array(select 'tasks/' || task_id::text || '/%' from unnest(v_tasks) as task_id)
           );
        end if;
      exception when others then
        raise notice 'account delete: chat media cleanup skipped: %', sqlerrm;
      end;

      -- 3) the auth row. Everything in public.* hangs off it by cascade --
      --    except any reference that was never given a delete rule. If Postgres
      --    names one, fix that exact constraint and retry.
      loop
        v_attempt := v_attempt + 1;

        begin
          delete from auth.users where id = v_uid;
          exit;  -- gone

        exception
          when foreign_key_violation or restrict_violation then
            get stacked diagnostics
              v_schema     = schema_name,
              v_table      = table_name,
              v_constraint = constraint_name;

            if v_constraint is null then
              raise exception 'Could not delete your account: %', sqlerrm;
            end if;

            if v_attempt > 40 then
              raise exception 'Could not delete your account. Last blocking reference: %', v_constraint;
            end if;

            -- If the same constraint blocks a second time, its SET NULL rule is
            -- meeting a NOT NULL column -- drop the child row instead.
            v_note := public.repair_delete_blocker(
              v_schema, v_table, v_constraint,
              case when v_constraint = v_last then 'cascade' else null end
            );
            v_last := v_constraint;
            raise notice 'account delete: repaired %', v_note;

          when not_null_violation or check_violation or unique_violation then
            -- A SET NULL rule hit a NOT NULL / CHECK / UNIQUE column. Find the
            -- SET NULL references on the table Postgres named and make them drop
            -- the child row instead, then retry.
            get stacked diagnostics
              v_schema = schema_name,
              v_table  = table_name;

            v_note := null;

            if v_table is not null then
              for r in
                select n2.nspname as schema_name,
                       t2.relname as table_name,
                       c2.conname as constraint_name
                from pg_constraint c2
                join pg_class t2     on t2.oid = c2.conrelid
                join pg_namespace n2 on n2.oid = t2.relnamespace
                where c2.contype = 'f'
                  and t2.relname = v_table
                  and (v_schema is null or n2.nspname = v_schema)
                  and pg_get_constraintdef(c2.oid) ilike '%on delete set null%'
              loop
                v_note := public.repair_delete_blocker(r.schema_name, r.table_name, r.constraint_name, 'cascade');
                raise notice 'account delete: repaired %', v_note;
              end loop;
            end if;

            if v_note is null and v_last is not null then
              v_note := public.repair_delete_blocker(null, null, v_last, 'cascade');
              raise notice 'account delete: repaired %', v_note;
            end if;

            if v_note is null or v_attempt > 40 then
              raise exception 'Could not delete your account: %', sqlerrm;
            end if;

          when lock_not_available or deadlock_detected then
            if v_attempt > 10 then
              raise;
            end if;
            perform pg_sleep(0.25);

          when others then
            raise exception 'Could not delete your account: %', sqlerrm;
        end;
      end loop;
    end
    $body$
  $ddl$;

  execute $ddl$ grant execute on function public.delete_own_account() to authenticated $ddl$;

  raise notice 'v054 applied: account deletion now repairs its own blockers';
end
$migration$;
