-- Supabase SQL Editor에서 실행합니다.
-- 문제지별 GIF/JPG/PNG 썸네일을 비공개 Storage에 저장하고 소유자만 접근하도록 합니다.
begin;

create table if not exists public.quiz_bank_thumbnails (
  bank_id text primary key references public.quiz_banks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null,
  updated_at timestamptz not null default now(),
  constraint quiz_bank_thumbnails_owner_bank_key unique (owner_id, bank_id),
  constraint quiz_bank_thumbnails_path_owner check (split_part(object_path, '/', 1) = owner_id::text)
);

alter table public.quiz_bank_thumbnails enable row level security;
revoke all on public.quiz_bank_thumbnails from public, anon;
grant select, insert, update, delete on public.quiz_bank_thumbnails to authenticated;

drop policy if exists quiz_bank_thumbnails_select_own on public.quiz_bank_thumbnails;
create policy quiz_bank_thumbnails_select_own on public.quiz_bank_thumbnails
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists quiz_bank_thumbnails_insert_own on public.quiz_bank_thumbnails;
create policy quiz_bank_thumbnails_insert_own on public.quiz_bank_thumbnails
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.quiz_banks bank
      where bank.id = quiz_bank_thumbnails.bank_id and bank.owner_id = (select auth.uid()) and bank.deleted_at is null
    )
  );
drop policy if exists quiz_bank_thumbnails_update_own on public.quiz_bank_thumbnails;
create policy quiz_bank_thumbnails_update_own on public.quiz_bank_thumbnails
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.quiz_banks bank
      where bank.id = quiz_bank_thumbnails.bank_id and bank.owner_id = (select auth.uid()) and bank.deleted_at is null
    )
  );
drop policy if exists quiz_bank_thumbnails_delete_own on public.quiz_bank_thumbnails;
create policy quiz_bank_thumbnails_delete_own on public.quiz_bank_thumbnails
  for delete to authenticated using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-thumbnails', 'quiz-thumbnails', false, 5242880, array['image/gif', 'image/jpeg', 'image/png']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists quiz_thumbnails_read_own on storage.objects;
create policy quiz_thumbnails_read_own on storage.objects
  for select to authenticated using (
    bucket_id = 'quiz-thumbnails' and split_part(name, '/', 1) = (select auth.uid())::text
  );
drop policy if exists quiz_thumbnails_insert_own on storage.objects;
create policy quiz_thumbnails_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'quiz-thumbnails' and split_part(name, '/', 1) = (select auth.uid())::text
  );
drop policy if exists quiz_thumbnails_update_own on storage.objects;
create policy quiz_thumbnails_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'quiz-thumbnails' and split_part(name, '/', 1) = (select auth.uid())::text
  ) with check (
    bucket_id = 'quiz-thumbnails' and split_part(name, '/', 1) = (select auth.uid())::text
  );
drop policy if exists quiz_thumbnails_delete_own on storage.objects;
create policy quiz_thumbnails_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'quiz-thumbnails' and split_part(name, '/', 1) = (select auth.uid())::text
  );

commit;
