-- 문제 서칭 카드 썸네일: 앞 문항 최대 6개(문항 80자, 보기 4개·각 40자)를 함께 돌려준다.
-- 정답·해설은 넣지 않는다. 함수 모양(인자)은 018과 같고, 다시 실행해도 안전하다.

create or replace function public.moonble_list_public_quizzes(
  p_query text default null,
  p_sort text default 'popular',
  p_offset integer default 0,
  p_limit integer default 20,
  p_category text default null
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

revoke all on function public.moonble_list_public_quizzes(text, text, integer, integer, text) from public;
grant execute on function public.moonble_list_public_quizzes(text, text, integer, integer, text) to anon, authenticated;
