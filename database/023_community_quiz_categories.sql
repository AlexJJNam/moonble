-- 커뮤니티 글의 분류를 문제지와 같은 카테고리로 저장하고 서버에서 필터링합니다.
-- 022_quiz_preview_comment.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
begin;

-- 기존 글의 topic 값은 유지하고 새 글에는 문제 카테고리 값을 허용합니다.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.community_posts'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%topic%'
  loop
    execute format('alter table public.community_posts drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.community_posts
  add constraint community_posts_topic_check check (
    topic is null or topic in (
      'marketing', 'dev', 'design', 'planning', 'business', 'language', 'certificate', 'school', 'general', 'etc',
      'question', 'review', 'tip', 'error'
    )
  );

-- create/edit RPC는 기존 로직을 보존하면서 topic 허용 값만 확장합니다.
do $$
declare
  definition text;
begin
  definition := pg_catalog.pg_get_functiondef('public.moonble_create_community_post(text,text,text,text,uuid,boolean,jsonb)'::regprocedure);
  definition := replace(definition,
    'clean_topic not in (''question'', ''review'', ''tip'', ''error'')',
    'clean_topic not in (''marketing'', ''dev'', ''design'', ''planning'', ''business'', ''language'', ''certificate'', ''school'', ''general'', ''etc'', ''question'', ''review'', ''tip'', ''error'')');
  if position('marketing' in definition) = 0 then raise exception 'Could not update community create RPC'; end if;
  execute definition;

  definition := pg_catalog.pg_get_functiondef('public.moonble_update_community_post(uuid,text,text,text,jsonb)'::regprocedure);
  definition := replace(definition,
    'clean_topic not in (''question'', ''review'', ''tip'', ''error'')',
    'clean_topic not in (''marketing'', ''dev'', ''design'', ''planning'', ''business'', ''language'', ''certificate'', ''school'', ''general'', ''etc'', ''question'', ''review'', ''tip'', ''error'')');
  if position('marketing' in definition) = 0 then raise exception 'Could not update community edit RPC'; end if;
  execute definition;
end;
$$;

create or replace function public.moonble_list_community_posts_by_category(
  p_scope text default 'all',
  p_token_hash text default null,
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
  share_row public.quiz_shares;
  viewer_id uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  page_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  post_items jsonb;
  post_total integer;
begin
  if p_category not in ('marketing', 'dev', 'design', 'planning', 'business', 'language', 'certificate', 'school', 'general', 'etc') then
    raise exception 'Invalid category' using errcode = '22023';
  end if;
  if p_scope = 'share' then
    share_row := public.moonble_active_quiz_share(p_token_hash);
    if share_row.id is null then raise exception 'Share not found' using errcode = 'P0002'; end if;
  elsif p_scope = 'mine' or p_scope = 'liked' then
    if viewer_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  elsif p_scope is distinct from 'all' then
    raise exception 'Invalid scope' using errcode = '22023';
  end if;

  select count(*)::integer into post_total
  from public.community_posts as post
  where post.deleted_at is null
    and post.topic = p_category
    and (share_row.id is null or post.share_id = share_row.id)
    and (p_scope <> 'mine' or post.author_id = viewer_id)
    and (p_scope <> 'liked' or exists (select 1 from public.community_post_likes as liked where liked.post_id = post.id and liked.user_id = viewer_id));

  select coalesce(jsonb_agg(public.moonble_community_post_json(page.post, viewer_id) order by page.position), '[]'::jsonb)
    into post_items
  from (
    select post, row_number() over (
      order by
        case when p_sort = 'latest' then null else post.like_count end desc nulls last,
        case when p_sort = 'latest' then null else post.comment_count end desc nulls last,
        post.created_at desc,
        post.id desc
    ) as position
    from public.community_posts as post
    where post.deleted_at is null
      and post.topic = p_category
      and (share_row.id is null or post.share_id = share_row.id)
      and (p_scope <> 'mine' or post.author_id = viewer_id)
      and (p_scope <> 'liked' or exists (select 1 from public.community_post_likes as liked where liked.post_id = post.id and liked.user_id = viewer_id))
    order by position offset page_offset limit page_size
  ) as page;

  return jsonb_build_object(
    'posts', post_items,
    'total', post_total,
    'viewer', jsonb_build_object(
      'signed_in', viewer_id is not null,
      'is_share_owner', viewer_id is not null and coalesce(share_row.owner_id = viewer_id, false)
    )
  );
end;
$$;
revoke all on function public.moonble_list_community_posts_by_category(text,text,text,integer,integer,text) from public;
grant execute on function public.moonble_list_community_posts_by_category(text,text,text,integer,integer,text) to anon, authenticated;

commit;
