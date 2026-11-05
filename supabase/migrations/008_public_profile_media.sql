create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  constraint profile_media_path_owner check (storage_path like profile_id::text || '/%')
);

create index if not exists profile_media_profile_created_idx
  on public.profile_media (profile_id, created_at desc);

alter table public.profile_media enable row level security;
grant select on public.profile_media to anon, authenticated;
grant insert, delete on public.profile_media to authenticated;
revoke update on public.profile_media from anon, authenticated;

drop policy if exists profile_media_public_read on public.profile_media;
create policy profile_media_public_read on public.profile_media
  for select using (true);

drop policy if exists profile_media_insert_own on public.profile_media;
create policy profile_media_insert_own on public.profile_media
  for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists profile_media_delete_own on public.profile_media;
create policy profile_media_delete_own on public.profile_media
  for delete to authenticated
  using (auth.uid() = profile_id);

create or replace function public.guard_profile_media_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_count integer;
begin
  if auth.uid() is not null and auth.uid() <> new.profile_id then
    raise exception 'You can only publish media on your own profile';
  end if;

  if new.media_type = 'image' and new.storage_path !~ (
    '^' || new.profile_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
  ) then
    raise exception 'Invalid profile image storage path';
  end if;
  if new.media_type = 'video' and new.storage_path !~ (
    '^' || new.profile_id::text || '/[0-9a-fA-F-]{36}\.(mp4|webm|mov)$'
  ) then
    raise exception 'Invalid profile media storage path';
  end if;

  perform 1
    from public.profiles
   where id = new.profile_id
   for update;

  select count(*) into v_item_count
    from public.profile_media
   where profile_id = new.profile_id;

  if v_item_count >= 6 then
    raise exception 'A profile can have up to 6 public media items';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_media_insert on public.profile_media;
create trigger trg_guard_profile_media_insert
before insert on public.profile_media
for each row execute function public.guard_profile_media_insert();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  31457280,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_media_storage_public_read on storage.objects;
create policy profile_media_storage_public_read on storage.objects
  for select using (bucket_id = 'profile-media');

drop policy if exists profile_media_storage_insert_own on storage.objects;
create policy profile_media_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_media_storage_delete_own on storage.objects;
create policy profile_media_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
