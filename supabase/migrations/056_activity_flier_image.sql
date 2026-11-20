-- ============================================================
-- Come w' me — activity flier image + share preview (v056)
-- Run in Supabase SQL Editor -> New query -> Run
-- Safe to run more than once.
-- ============================================================

-- ---------- public URL of the activity flier on the task ----------
alter table public.tasks
  add column if not exists image_url text;

-- TASK_COLUMNS in the client must include image_url (already updated in the app).

-- ---------- public storage bucket for fliers ----------
insert into storage.buckets (id, name, public)
values ('activity-media', 'activity-media', true)
on conflict (id) do update set public = true;

drop policy if exists activity_media_insert_own on storage.objects;
create policy activity_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'activity-media' and owner = auth.uid());

drop policy if exists activity_media_update_own on storage.objects;
create policy activity_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'activity-media' and owner = auth.uid())
  with check (bucket_id = 'activity-media' and owner = auth.uid());

drop policy if exists activity_media_delete_own on storage.objects;
create policy activity_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-media' and owner = auth.uid());

-- ---------- flier changes obey the same 30-minute window ----------
create or replace function public.guard_task_image_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.image_url is distinct from old.image_url then
    if auth.uid() is distinct from old.host_id then
      raise exception 'Only the host can change the activity photo';
    end if;
    if old.status not in ('open', 'full') then
      raise exception 'This activity can no longer be edited';
    end if;
    if now() > old.created_at + interval '30 minutes' then
      raise exception 'The 30-minute edit window has closed';
    end if;
    if new.image_url is not null
       and (new.image_url not like 'https://%'
            or new.image_url not like '%/storage/v1/object/public/activity-media/%') then
      raise exception 'The photo must be an uploaded activity image';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_task_image_window on public.tasks;
create trigger trg_guard_task_image_window
  before update on public.tasks
  for each row execute function public.guard_task_image_window();

create or replace function public.log_task_image_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.image_url is distinct from old.image_url then
    insert into public.task_edit_log (task_id, edited_by, changes)
    values (new.id, coalesce(auth.uid(), old.host_id),
            jsonb_build_object('image_url', jsonb_build_array(old.image_url, new.image_url)));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_task_image_edit on public.tasks;
create trigger trg_log_task_image_edit
  after update on public.tasks
  for each row execute function public.log_task_image_edit();

-- ---------- host-facing flier RPC ----------
create or replace function public.set_task_image(p_task_id uuid, p_image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_requester uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Activity not found';
  end if;
  if v_task.host_id <> auth.uid() then
    raise exception 'Only the host can change the activity photo';
  end if;
  if v_task.status not in ('open', 'full') then
    raise exception 'This activity can no longer be edited';
  end if;
  if now() > v_task.created_at + interval '30 minutes' then
    raise exception 'The 30-minute edit window has closed';
  end if;

  update public.tasks set image_url = p_image_url where id = p_task_id;

  for v_requester in
    select distinct requester_id
    from public.join_requests
    where task_id = p_task_id
      and status in ('pending', 'accepted', 'waitlisted')
      and requester_id <> auth.uid()
  loop
    perform public.push_notification(
      v_requester,
      'info',
      'Activity photo updated',
      'The host changed the photo for "' || v_task.title || '".',
      '/task/' || p_task_id::text
    );
  end loop;
end;
$$;

revoke all on function public.set_task_image(uuid, text) from public, anon;
grant execute on function public.set_task_image(uuid, text) to authenticated;
