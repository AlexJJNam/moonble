-- 문제 찾기(공개 문제) 카드에 출제자 프로필 사진(유튜브처럼 제목 왼쪽).
-- 1) 공개 문제 목록에 author_avatar(출제자의 현재 프로필 사진 경로)를 더한다. 나머지 응답은 020과 같다.
-- 2) 문제를 공개한 사람의 "현재" 프로필 사진도 다른 사람이 볼 수 있게 한다(커뮤니티에 글·댓글을 남긴 사람과 같은 규칙).
--    이전 사진 파일과 공개 활동이 없는 사람의 사진은 계속 본인만 볼 수 있다.
-- 데이터는 바꾸지 않는다. 다시 실행해도 안전하다.

create or replace function public.moonble_community_avatar_visible(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(coalesce(p_object_name, ''), '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then exists (
      select 1
      from auth.users as account
      where account.id = split_part(p_object_name, '/', 1)::uuid
        and public.moonble_community_author_avatar(account.id) = p_object_name
        and (
          exists (select 1 from public.community_posts as post where post.author_id = account.id and post.deleted_at is null)
          or exists (select 1 from public.community_post_comments as comment where comment.author_id = account.id and comment.deleted_at is null)
          or exists (
            select 1
            from public.quiz_shares as share
            join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
            where share.owner_id = account.id and share.visibility = 'public' and share.revoked_at is null and share.public_token is not null and bank.deleted_at is null
          )
        )
    )
    else false
  end;
$$;
revoke all on function public.moonble_community_avatar_visible(text) from public;
grant execute on function public.moonble_community_avatar_visible(text) to anon, authenticated;

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
    where share.visibility = 'public' and share.revoked_at is null and share.public_token is not null and bank.deleted_at is null
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
      'participants', page.participants,
      'average_score', page.average_score,
      'post_count', page.post_count,
      'published_at', page.published_at,
      'category', page.bank_category,
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
