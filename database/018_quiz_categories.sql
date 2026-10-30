-- 문제지 카테고리: 만들 때 고르고, 나의 문제지·문제 서칭에서 검색·필터에 쓴다.
-- 1) quiz_banks.category 컬럼(정해진 값만 허용, 비어 있어도 된다)
-- 2) 문제지 저장 RPC가 카테고리를 함께 저장한다(카테고리를 보내지 않는 이전 화면은 기존 값을 유지).
-- 3) 공개 문제 검색 RPC에 카테고리 필터(p_category)와 결과의 category를 더한다.
-- 기존 데이터는 지우지 않는다. 다시 실행해도 안전하다.

alter table public.quiz_banks add column if not exists category text;
alter table public.quiz_banks drop constraint if exists quiz_banks_category_check;
alter table public.quiz_banks add constraint quiz_banks_category_check
  check (category is null or category in ('marketing', 'dev', 'design', 'planning', 'business', 'language', 'certificate', 'school', 'general', 'etc'));
create index if not exists quiz_banks_category_idx on public.quiz_banks (category) where deleted_at is null;

create or replace function public.moonble_save_custom_bank_collection(
  p_groups jsonb,
  p_banks jsonb,
  p_deleted_group_ids text[] default '{}',
  p_deleted_bank_ids text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  item jsonb;
  question_item jsonb;
  item_id text;
  item_group_id text;
  item_updated_at timestamptz;
  item_category text;
  item_has_category boolean;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_typeof(p_banks) is distinct from 'array' then
    raise exception 'Invalid problem collection' using errcode = '22023';
  end if;
  if jsonb_array_length(p_groups) > 200 or jsonb_array_length(p_banks) > 500
    or octet_length(p_groups::text) + octet_length(p_banks::text) > 12000000 then
    raise exception 'Invalid problem collection' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_groups) loop
    item_id := item ->> 'id';
    if jsonb_typeof(item) is distinct from 'object'
      or item_id is null or char_length(item_id) not between 1 and 120
      or jsonb_typeof(item -> 'name') is distinct from 'string'
      or char_length(btrim(item ->> 'name')) not between 1 and 24 then
      raise exception 'Invalid group' using errcode = '22023';
    end if;
    item_updated_at := coalesce(nullif(item ->> 'updated_at', '')::timestamptz, nullif(item ->> 'updatedAt', '')::timestamptz, now());
    insert into public.quiz_groups (id, owner_id, name, sort_order, created_at, updated_at, deleted_at)
    values (
      item_id, requesting_user_id, btrim(item ->> 'name'), coalesce((item ->> 'sort_order')::integer, 0),
      coalesce(nullif(item ->> 'created_at', '')::timestamptz, nullif(item ->> 'createdAt', '')::timestamptz, now()),
      item_updated_at, null
    )
    on conflict (id) do update set
      name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
    where quiz_groups.owner_id = requesting_user_id
      and quiz_groups.deleted_at is null
      and excluded.updated_at >= quiz_groups.updated_at;
  end loop;

  for item in select value from jsonb_array_elements(p_banks) loop
    item_id := item ->> 'id';
    item_group_id := nullif(item ->> 'group_id', '');
    if item_group_id = 'ungrouped' then item_group_id := null; end if;
    if jsonb_typeof(item) is distinct from 'object'
      or item_id is null or char_length(item_id) not between 1 and 120
      or jsonb_typeof(item -> 'title') is distinct from 'string'
      or char_length(btrim(item ->> 'title')) not between 1 and 100
      or jsonb_typeof(item -> 'questions') is distinct from 'array'
      or octet_length(coalesce((item -> 'questions')::text, '')) > 2000000 then
      raise exception 'Invalid problem bank' using errcode = '22023';
    end if;
    if jsonb_array_length(item -> 'questions') not between 20 and 1000 then
      raise exception 'Invalid problem bank' using errcode = '22023';
    end if;
    if item_group_id is not null and not exists (
      select 1 from public.quiz_groups as group_row
      where group_row.id = item_group_id and group_row.owner_id = requesting_user_id and group_row.deleted_at is null
    ) then
      item_group_id := null;
    end if;
    for question_item in select value from jsonb_array_elements(item -> 'questions') loop
      if jsonb_typeof(question_item -> 'id') is distinct from 'number'
        or jsonb_typeof(question_item -> 'q') is distinct from 'string'
        or jsonb_typeof(question_item -> 'options') is distinct from 'array'
        or jsonb_typeof(question_item -> 'correct') is distinct from 'array' then
        raise exception 'Invalid question in problem bank' using errcode = '22023';
      end if;
      if jsonb_array_length(question_item -> 'options') not between 2 and 12
        or jsonb_array_length(question_item -> 'correct') < 1 then
        raise exception 'Invalid question in problem bank' using errcode = '22023';
      end if;
    end loop;
    item_updated_at := coalesce(nullif(item ->> 'updated_at', '')::timestamptz, nullif(item ->> 'updatedAt', '')::timestamptz, now());
    -- 카테고리를 보내지 않는 이전 화면이 저장해도 기존 카테고리는 지우지 않는다.
    item_has_category := item ? 'category';
    item_category := nullif(item ->> 'category', '');
    if item_category is not null and item_category not in ('marketing', 'dev', 'design', 'planning', 'business', 'language', 'certificate', 'school', 'general', 'etc') then item_category := null; end if;
    insert into public.quiz_banks (id, owner_id, group_id, title, description, source, questions, sort_order, saved_at, updated_at, deleted_at, category)
    values (
      item_id, requesting_user_id, item_group_id, btrim(item ->> 'title'), coalesce(item ->> 'description', ''),
      coalesce(item ->> 'source', '커스텀 문제'), item -> 'questions', coalesce((item ->> 'sort_order')::integer, 0),
      coalesce(nullif(item ->> 'saved_at', '')::timestamptz, nullif(item ->> 'savedAt', '')::timestamptz, now()), item_updated_at, null, item_category
    )
    on conflict (id) do update set
      group_id = excluded.group_id,
      title = excluded.title,
      description = excluded.description,
      source = excluded.source,
      questions = excluded.questions,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      category = case when item_has_category then excluded.category else quiz_banks.category end
    where quiz_banks.owner_id = requesting_user_id
      and quiz_banks.deleted_at is null
      and excluded.updated_at >= quiz_banks.updated_at;
  end loop;

  if coalesce(cardinality(p_deleted_bank_ids), 0) > 0 then
    update public.quiz_banks
    set deleted_at = now(), updated_at = now()
    where owner_id = requesting_user_id and id = any(p_deleted_bank_ids) and deleted_at is null;
    update public.quiz_shares
    set revoked_at = coalesce(revoked_at, now())
    where owner_id = requesting_user_id and bank_id = any(p_deleted_bank_ids);
  end if;

  if coalesce(cardinality(p_deleted_group_ids), 0) > 0 then
    update public.quiz_banks
    set group_id = null, updated_at = now()
    where owner_id = requesting_user_id and group_id = any(p_deleted_group_ids) and deleted_at is null;
    update public.quiz_groups
    set deleted_at = now(), updated_at = now()
    where owner_id = requesting_user_id and id = any(p_deleted_group_ids) and deleted_at is null;
  end if;
end;
$$;

drop function if exists public.moonble_list_public_quizzes(text, text, integer, integer);

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
      'category', page.bank_category
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

revoke all on function public.moonble_save_custom_bank_collection(jsonb, jsonb, text[], text[]) from public, anon;
grant execute on function public.moonble_save_custom_bank_collection(jsonb, jsonb, text[], text[]) to authenticated;
revoke all on function public.moonble_list_public_quizzes(text, text, integer, integer, text) from public;
grant execute on function public.moonble_list_public_quizzes(text, text, integer, integer, text) to anon, authenticated;
