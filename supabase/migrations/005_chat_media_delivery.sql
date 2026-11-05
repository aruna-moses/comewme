-- Enable durable image and voice-note delivery in task group chats.
alter table public.messages
  add column if not exists type text default 'text',
  add column if not exists url text,
  add column if not exists duration int;

update public.messages set type = 'text' where type is null;

alter table public.messages
  alter column type set default 'text',
  alter column type set not null,
  drop constraint if exists messages_type_check,
  drop constraint if exists messages_body_check,
  add constraint messages_type_check check (type in ('text', 'image', 'audio')),
  add constraint messages_body_check check (
    (type = 'text' and char_length(body) between 1 and 2000)
    or (type in ('image', 'audio') and char_length(body) = 0)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
        'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

drop policy if exists chat_media_select on storage.objects;
create policy chat_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and case
      when split_part(name, '/', 1) = 'tasks'
        and split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and split_part(name, '/', 3) <> ''
      then public.is_task_participant(split_part(name, '/', 2)::uuid)
      else false
    end
  );

create index if not exists messages_task_type_idx
  on public.messages (task_id, type, created_at);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    )
  then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;
