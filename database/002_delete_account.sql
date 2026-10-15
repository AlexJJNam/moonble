-- Supabase SQL Editor에서 001_profiles.sql 적용 후 실행합니다.
-- 로그인한 사용자가 인자를 조작하지 않고 자기 계정만 삭제할 수 있는 RPC입니다.
begin;

create or replace function public.moonble_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from auth.users
  where id = requesting_user_id;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.moonble_delete_account() from public, anon;
grant execute on function public.moonble_delete_account() to authenticated;

commit;
