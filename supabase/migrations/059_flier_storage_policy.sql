-- ============================================================
-- Come w' me — reliable activity flier ownership policy (v059)
-- Run in Supabase SQL Editor -> New query -> Run
-- Some storage schemas don't populate storage.objects.owner for uploads made
-- through the Storage API. Our flier paths always start with the owner's uid,
-- so use that instead — it is deterministic and works on every project.
-- ============================================================

drop policy if exists activity_media_insert_own on storage.objects;
create policy activity_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists activity_media_update_own on storage.objects;
create policy activity_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists activity_media_delete_own on storage.objects;
create policy activity_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'activity-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
