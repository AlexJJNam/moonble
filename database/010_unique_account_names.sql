-- 계정 이름 중복 확인과 동시 저장 방지를 위한 함수/트리거입니다.
-- 기존 계정의 이름은 임의로 변경하지 않고, 이 마이그레이션 이후 설정·변경하는 이름부터 중복을 막습니다.
begin;

create or replace function public.moonble_normalize_account_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g')
  );
$$;
revoke all on function public.moonble_normalize_account_name(text) from public, anon, authenticated;

create or replace function public.moonble_account_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and nullif(public.moonble_normalize_account_name(p_name), '') is not null
    and not exists (
      select 1
      from auth.users as account
      where account.id <> (select auth.uid())
        and public.moonble_normalize_account_name(account.raw_user_meta_data ->> 'name')
          = public.moonble_normalize_account_name(p_name)
    );
$$;
revoke all on function public.moonble_account_name_available(text) from public, anon;
grant execute on function public.moonble_account_name_available(text) to authenticated;

create or replace function public.moonble_enforce_unique_account_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_new_name text;
  normalized_old_name text;
begin
  normalized_new_name := public.moonble_normalize_account_name(new.raw_user_meta_data ->> 'name');
  if normalized_new_name = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    normalized_old_name := public.moonble_normalize_account_name(old.raw_user_meta_data ->> 'name');
    if normalized_new_name = normalized_old_name then
      return new;
    end if;
  end if;

  -- 같은 이름을 동시에 저장하는 경우에도 한 트랜잭션만 통과하도록 잠급니다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_new_name, 0));

  if exists (
    select 1
    from auth.users as account
    where account.id <> new.id
      and public.moonble_normalize_account_name(account.raw_user_meta_data ->> 'name') = normalized_new_name
  ) then
    raise exception using
      errcode = '23505',
      message = 'ACCOUNT_NAME_TAKEN';
  end if;

  return new;
end;
$$;
revoke all on function public.moonble_enforce_unique_account_name() from public, anon, authenticated;

drop trigger if exists moonble_unique_account_name on auth.users;
create trigger moonble_unique_account_name
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.moonble_enforce_unique_account_name();

commit;
