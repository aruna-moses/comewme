-- ============================================================
-- Come w' me — storage SELECT policies so cleanup can find files (v060)
-- Run in Supabase SQL Editor -> New query -> Run
-- Uploads and deletes worked, but storage.objects had no SELECT policy for
-- these buckets, so Storage API list() silently returned zero objects —
-- media cleanup was a no-op. These policies are strictly own-file scoped.
-- ============================================================

do $$
declare
  b text;
begin
  foreach b in array array['avatars', 'activity-media', 'ad-media', 'profile-media']
  loop
    execute format('drop policy if exists %I on storage.objects', 'comewme_select_own_' || replace(b, '-', '_'));
    execute format($f$
      create policy %I on storage.objects
        for select to authenticated
        using (
          bucket_id = %L
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $f$, 'comewme_select_own_' || replace(b, '-', '_'), b);
  end loop;
end $$;

drop policy if exists comewe_select_chat_participant on storage.objects;
create policy comewe_select_chat_participant on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
    and public.is_task_participant(split_part(name, '/', 2)::uuid)
  );
