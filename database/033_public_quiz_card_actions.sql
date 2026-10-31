-- 문제 찾기 카드 메뉴의 소유자 편집 및 사용자 차단 기능.
-- 032_shared_quiz_thumbnails.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
begin;

create table if not exists public.quiz_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint quiz_user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.quiz_user_blocks enable row level security;
revoke all on table public.quiz_user_blocks from public, anon, authenticated;

-- 차단 요청은 공유 토큰으로 서버에서 작성자를 확인하므로 다른 계정 ID를 전달하지 않습니다.
create or replace function public.moonble_block_public_quiz_author(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  blocked_user_id uuid;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid public quiz token' using errcode = '22023';
  end if;

  select share.owner_id into blocked_user_id
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.public_token = p_token
    and share.visibility = 'public'
    and share.revoked_at is null
    and bank.deleted_at is null
  order by share.created_at desc
  limit 1;

  if blocked_user_id is null then
    raise exception 'Public quiz not found' using errcode = 'P0002';
  end if;
  if blocked_user_id = requesting_user_id then
    raise exception 'Cannot block yourself' using errcode = '22023';
  end if;

  insert into public.quiz_user_blocks (blocker_id, blocked_id)
  values (requesting_user_id, blocked_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
  return true;
end;
$$;

revoke all on function public.moonble_block_public_quiz_author(text) from public, anon, authenticated;
grant execute on function public.moonble_block_public_quiz_author(text) to authenticated;

-- 차단 여부와 내 문제지 ID는 문제 찾기 응답에만 포함하며,
-- 다른 사용자의 내부 bank ID는 반환하지 않습니다.
create or replace function public.moonble_list_public_quizzes(
  p_query text default null,
  p_sort text default 'popular',
  p_offset integer default 0,
  p_limit integer default 20,
  p_category text default null,
  p_tokens text[] default null
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
  if p_tokens is not null and cardinality(p_tokens) > 300 then
    raise exception 'Too many tokens' using errcode = '22023';
  end if;
  if search_text is not null then
    pattern := '%' || replace(replace(replace(search_text, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with latest as (
    select distinct on (share.bank_id) share.*, bank.category as bank_category
    from public.quiz_shares as share
    join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
    where share.visibility = 'public'
      and share.revoked_at is null
      and share.public_token is not null
      and bank.deleted_at is null
    order by share.bank_id, share.created_at desc
  ),
  matched as (
    select latest.*
    from latest
    where (p_category is null or latest.bank_category = p_category)
      and (p_tokens is null or latest.public_token = any(p_tokens))
      and (pattern is null
        or (latest.snapshot ->> 'title') ilike pattern escape '\'
        or (latest.snapshot ->> 'description') ilike pattern escape '\')
      and not exists (
        select 1
        from public.quiz_user_blocks as block
        where block.blocker_id = auth.uid()
          and block.blocked_id = latest.owner_id
      )
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
      'author_avatar', public.moonble_community_author_avatar(page.owner_id),
      'thumbnail_path', (select thumbnail.object_path from public.quiz_bank_thumbnails as thumbnail where thumbnail.bank_id = page.bank_id and thumbnail.owner_id = page.owner_id),
      'thumbnail_media', (select thumbnail.media from public.quiz_bank_thumbnails as thumbnail where thumbnail.bank_id = page.bank_id and thumbnail.owner_id = page.owner_id and thumbnail.provider = 'klipy'),
      'participants', page.participants,
      'average_score', page.average_score,
      'post_count', page.post_count,
      'published_at', page.published_at,
      'category', page.bank_category,
      'is_mine', page.owner_id = auth.uid(),
      'owner_bank_id', case when page.owner_id = auth.uid() then page.bank_id else null end,
      'samples', coalesce((
        select jsonb_agg(jsonb_build_object(
          'q', left(coalesce(question.value ->> 'q', ''), 80),
          'options', coalesce((
            select jsonb_agg(left(option.value, 40) order by option.ordinality)
            from jsonb_array_elements_text(case when jsonb_typeof(question.value -> 'options') = 'array' then question.value -> 'options' else '[]'::jsonb end) with ordinality as option(value, ordinality)
            where option.ordinality <= 4
          ), '[]'::jsonb)
        ) order by question.ordinality)
        from jsonb_array_elements(case when jsonb_typeof(page.snapshot -> 'questions') = 'array' then page.snapshot -> 'questions' else '[]'::jsonb end) with ordinality as question(value, ordinality)
        where question.ordinality <= 6
      ), '[]'::jsonb)
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

revoke all on function public.moonble_list_public_quizzes(text, text, integer, integer, text, text[]) from public;
grant execute on function public.moonble_list_public_quizzes(text, text, integer, integer, text, text[]) to anon, authenticated;

commit;
