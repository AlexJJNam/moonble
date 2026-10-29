-- 문제지 공개 범위(공개 / 일부 공개 / 미공개)와 공개 문제 검색.
-- 015_community_my_activity.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 공유 링크는 모두 '일부 공개(링크를 아는 사람만)'로 남고, 이미 나간 링크는 그대로 동작합니다.
-- 공개로 올린 문제만 검색에 노출되고, 목록에는 정답과 선택지를 내보내지 않습니다.
begin;

alter table public.quiz_shares add column if not exists visibility text not null default 'unlisted' check (visibility in ('public', 'unlisted'));
alter table public.quiz_shares add column if not exists public_token text check (public_token is null or public_token ~ '^[A-Za-z0-9_-]{40,50}$');
alter table public.quiz_shares add column if not exists published_at timestamptz;
create index if not exists quiz_shares_public_idx on public.quiz_shares (published_at desc) where visibility = 'public' and revoked_at is null;

-- 공개 범위 변경(공유 링크가 이미 만들어져 있어야 한다). 미공개는 기존 공유 중지를 쓴다.
-- 공개로 올릴 때는 링크의 원래 토큰을 받아 해시가 일치하는지 확인한 뒤 검색 결과 링크에 쓴다.
create or replace function public.moonble_set_quiz_share_visibility(p_bank_id text, p_visibility text, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  share_row public.quiz_shares;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_visibility is null or p_visibility not in ('public', 'unlisted') then
    raise exception 'Invalid visibility' using errcode = '22023';
  end if;
  select share.* into share_row
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.bank_id = p_bank_id and share.owner_id = requesting_user_id and share.revoked_at is null and bank.deleted_at is null
  order by share.created_at desc
  limit 1;
  if share_row.id is null then
    raise exception 'Share not found' using errcode = 'P0002';
  end if;
  if p_visibility = 'public' then
    if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,50}$'
      or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex') <> share_row.token_hash then
      raise exception 'Invalid share token' using errcode = '22023';
    end if;
  end if;
  -- 같은 문제지의 다른 활성 링크는 비공개 목록 상태로 돌린다(링크 자체는 계속 동작).
  update public.quiz_shares set visibility = 'unlisted', public_token = null, published_at = null
  where bank_id = p_bank_id and owner_id = requesting_user_id and revoked_at is null and id <> share_row.id and visibility <> 'unlisted';
  update public.quiz_shares
  set visibility = p_visibility,
      public_token = case when p_visibility = 'public' then p_token end,
      published_at = case when p_visibility = 'public' then coalesce(published_at, now()) end
  where id = share_row.id;
  return jsonb_build_object('visibility', p_visibility);
end;
$$;

-- 내 문제지별 현재 공개 범위: { bank_id: 'public' | 'unlisted' }. 목록에 없으면 미공개.
create or replace function public.moonble_my_quiz_share_visibility()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(latest.bank_id, latest.visibility)
    from (
      select distinct on (share.bank_id) share.bank_id, share.visibility
      from public.quiz_shares as share
      join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
      where share.owner_id = requesting_user_id and share.revoked_at is null and bank.deleted_at is null
      order by share.bank_id, share.created_at desc
    ) as latest
  ), '{}'::jsonb);
end;
$$;

-- 공개 문제 검색. 누구나 조회할 수 있고 정답·선택지는 내보내지 않는다.
create or replace function public.moonble_list_public_quizzes(
  p_query text default null,
  p_sort text default 'popular',
  p_offset integer default 0,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  page_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  search_text text := nullif(btrim(left(coalesce(p_query, ''), 50)), '');
  pattern text;
  item_list jsonb;
  item_total integer;
begin
  if search_text is not null then
    pattern := '%' || replace(replace(replace(search_text, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with latest as (
    select distinct on (share.bank_id) share.*
    from public.quiz_shares as share
    join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
    where share.visibility = 'public' and share.revoked_at is null and share.public_token is not null and bank.deleted_at is null
    order by share.bank_id, share.created_at desc
  ),
  matched as (
    select latest.*
    from latest
    where pattern is null
      or (latest.snapshot ->> 'title') ilike pattern escape '\'
      or (latest.snapshot ->> 'description') ilike pattern escape '\'
  ),
  stats as (
    select matched.*,
      (select count(*)::integer from public.quiz_share_participants as participant where participant.share_id = matched.id) as participants,
      (select round(avg(participant.best_score)::numeric, 1) from public.quiz_share_participants as participant where participant.share_id = matched.id) as average_score,
      (select count(*)::integer from public.community_posts as post where post.share_id = matched.id and post.deleted_at is null) as post_count
    from matched
  )
  select (select count(*)::integer from stats),
    coalesce(jsonb_agg(jsonb_build_object(
      'token', page.public_token,
      'title', left(coalesce(page.snapshot ->> 'title', '공유 문제'), 100),
      'description', left(coalesce(page.snapshot ->> 'description', ''), 120),
      'question_count', coalesce(jsonb_array_length(case when jsonb_typeof(page.snapshot -> 'questions') = 'array' then page.snapshot -> 'questions' end), 0),
      'preview', left(coalesce(page.snapshot -> 'questions' -> 0 ->> 'q', ''), 80),
      'author_name', coalesce(public.moonble_community_author_name(page.owner_id), '문블 사용자'),
      'participants', page.participants,
      'average_score', page.average_score,
      'post_count', page.post_count,
      'published_at', page.published_at
    ) order by page.position), '[]'::jsonb)
  into item_total, item_list
  from (
    select stats.*, row_number() over (
      order by
        case when p_sort = 'latest' then null else stats.participants end desc nulls last,
        case when p_sort = 'latest' then null else stats.post_count end desc nulls last,
        stats.published_at desc nulls last,
        stats.id
    ) as position
    from stats
    order by position
    offset page_offset
    limit page_size
  ) as page;
  return jsonb_build_object('items', item_list, 'total', coalesce(item_total, 0));
end;
$$;

revoke all on function public.moonble_set_quiz_share_visibility(text, text, text) from public, anon;
revoke all on function public.moonble_my_quiz_share_visibility() from public, anon;
revoke all on function public.moonble_list_public_quizzes(text, text, integer, integer) from public;
grant execute on function public.moonble_set_quiz_share_visibility(text, text, text) to authenticated;
grant execute on function public.moonble_my_quiz_share_visibility() to authenticated;
grant execute on function public.moonble_list_public_quizzes(text, text, integer, integer) to anon, authenticated;

commit;
