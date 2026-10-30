-- 공개 문제지 좋아요와 계정별 스크랩. 020_public_quiz_scraps.sql 이후 실행합니다.
-- 공유 링크를 새로 발급해도 좋아요가 유지되도록 문제지(bank) 기준으로 저장합니다.
begin;

create table if not exists public.quiz_public_likes (
  bank_id text not null references public.quiz_banks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  liked boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (bank_id, user_id)
);
alter table public.quiz_public_likes add column if not exists liked boolean not null default true;
create index if not exists quiz_public_likes_user_idx on public.quiz_public_likes (user_id, created_at desc);
alter table public.quiz_public_likes enable row level security;
revoke all on table public.quiz_public_likes from public, anon, authenticated;

-- 목록의 공개 토큰을 한 번에 조회합니다. 비공개·중지·삭제된 문제는 반환하지 않습니다.
create or replace function public.moonble_get_public_quiz_likes(p_tokens text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  requesting_user_id uuid := auth.uid();
begin
  if p_tokens is null or cardinality(p_tokens) > 300 or exists (
    select 1 from unnest(p_tokens) as token(value)
    where token.value is null or token.value !~ '^[A-Za-z0-9_-]{40,50}$'
  ) then
    raise exception 'Invalid tokens' using errcode = '22023';
  end if;

  with matched as (
    select distinct share.public_token as token, share.bank_id
    from public.quiz_shares as share
    join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
    where share.public_token = any(p_tokens)
      and share.visibility = 'public' and share.revoked_at is null and bank.deleted_at is null
  ), counts as (
    select matched.token, count(liked.user_id)::integer as like_count,
      coalesce(bool_or(liked.user_id = requesting_user_id), false) as liked
    from matched
    left join public.quiz_public_likes as liked on liked.bank_id = matched.bank_id and liked.liked
    group by matched.token
  )
  select coalesce(jsonb_agg(jsonb_build_object('token', counts.token, 'like_count', counts.like_count, 'liked', counts.liked)), '[]'::jsonb)
  into result from counts;
  return result;
end;
$$;

-- 목표 상태를 받아 중복 요청이나 재시도에도 같은 결과가 유지됩니다.
create or replace function public.moonble_set_public_quiz_like(p_token text, p_liked boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_bank_id text;
  total integer;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,50}$' or p_liked is null then
    raise exception 'Invalid like' using errcode = '22023';
  end if;

  select share.bank_id into target_bank_id
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.public_token = p_token and share.visibility = 'public'
    and share.revoked_at is null and bank.deleted_at is null
  order by share.created_at desc, share.id desc
  limit 1
  for share of share, bank;
  if target_bank_id is null then
    raise exception 'Public quiz not found' using errcode = 'P0002';
  end if;

  -- 해제 상태도 보관하여 다른 기기의 오래된 스크랩 이관이 취소한 좋아요를 되살리지 않게 합니다.
  insert into public.quiz_public_likes as existing (bank_id, user_id, liked)
  values (target_bank_id, requesting_user_id, p_liked)
  on conflict (bank_id, user_id) do update
    set liked = excluded.liked,
        created_at = case when excluded.liked and not existing.liked then now() else existing.created_at end;

  select count(*)::integer into total from public.quiz_public_likes as liked where liked.bank_id = target_bank_id and liked.liked;
  return jsonb_build_object('liked', p_liked, 'like_count', total);
end;
$$;

-- 기존 기기 스크랩을 계정 좋아요로 이전합니다. 이미 저장된 항목은 중복되지 않습니다.
create or replace function public.moonble_import_public_quiz_likes(p_tokens text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  imported integer;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_tokens is null or cardinality(p_tokens) > 300 or exists (
    select 1 from unnest(p_tokens) as token(value)
    where token.value is null or token.value !~ '^[A-Za-z0-9_-]{40,50}$'
  ) then
    raise exception 'Invalid tokens' using errcode = '22023';
  end if;

  insert into public.quiz_public_likes (bank_id, user_id)
  select distinct old_share.bank_id, requesting_user_id
  from unnest(p_tokens) as token(value)
  join public.quiz_shares as old_share
    on old_share.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(token.value, 'UTF8')), 'hex')
  join public.quiz_banks as bank on bank.id = old_share.bank_id and bank.owner_id = old_share.owner_id
  where bank.deleted_at is null and exists (
    select 1 from public.quiz_shares as active_share
    where active_share.bank_id = bank.id and active_share.owner_id = bank.owner_id
      and active_share.visibility = 'public' and active_share.revoked_at is null
      and active_share.public_token is not null
  )
  on conflict (bank_id, user_id) do nothing;
  get diagnostics imported = row_count;
  return jsonb_build_object('imported', imported);
end;
$$;

-- 계정에 저장한 스크랩 중 현재 공개된 문제의 최신 공유 토큰을 반환합니다.
create or replace function public.moonble_my_public_quiz_likes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  result jsonb;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item.token order by item.created_at desc, item.bank_id), '[]'::jsonb)
  into result
  from (
    select liked.bank_id, liked.created_at, active_share.public_token as token
    from public.quiz_public_likes as liked
    join public.quiz_banks as bank on bank.id = liked.bank_id and bank.deleted_at is null
    join lateral (
      select share.public_token
      from public.quiz_shares as share
      where share.bank_id = bank.id and share.owner_id = bank.owner_id
        and share.visibility = 'public' and share.revoked_at is null and share.public_token is not null
      order by share.created_at desc, share.id desc
      limit 1
    ) as active_share on true
    where liked.user_id = requesting_user_id and liked.liked
    order by liked.created_at desc, liked.bank_id
    limit 300
  ) as item;
  return result;
end;
$$;

revoke all on function public.moonble_get_public_quiz_likes(text[]) from public;
revoke all on function public.moonble_set_public_quiz_like(text, boolean) from public, anon;
revoke all on function public.moonble_import_public_quiz_likes(text[]) from public, anon;
revoke all on function public.moonble_my_public_quiz_likes() from public, anon;
grant execute on function public.moonble_get_public_quiz_likes(text[]) to anon, authenticated;
grant execute on function public.moonble_set_public_quiz_like(text, boolean) to authenticated;
grant execute on function public.moonble_import_public_quiz_likes(text[]) to authenticated;
grant execute on function public.moonble_my_public_quiz_likes() to authenticated;

commit;
