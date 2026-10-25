-- Supabase SQL Editor에서 새 쿼리로 한 번 실행합니다.
-- 프로필 사진은 비공개 버킷에 저장하고 계정 본인의 폴더만 관리할 수 있습니다.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  20971520,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_own on storage.objects;
create policy profile_avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

commit;
