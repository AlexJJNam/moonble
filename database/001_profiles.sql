-- Supabase SQL Editor에서 개발 프로젝트에 적용합니다.
-- 새 가입 계정에만 자동 적용됩니다. 기존 계정은 아래 backfill로 복구합니다.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, insert on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

-- 이번 버전에는 수정할 프로필 필드가 없으므로 UPDATE/DELETE 권한을 부여하지 않습니다.
create or replace function public.moonble_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.moonble_create_profile() from public, anon, authenticated;

drop trigger if exists moonble_auth_user_created on auth.users;
create trigger moonble_auth_user_created
  after insert on auth.users
  for each row execute function public.moonble_create_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

commit;
