-- 마이페이지 커뮤니티 활동: 내가 쓴 글·댓글 수, 내가 쓴 글/댓글/좋아요한 글 목록.
-- 014_community_edit_comment_likes.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 테이블·데이터는 바꾸지 않고 함수만 추가·확장합니다(기존 호출 방식도 그대로 동작).
begin;

-- 글 목록에 범위 'mine'(내가 쓴 글)·'liked'(내가 좋아요한 글)를 더한다. 두 범위는 로그인한 계정만 쓸 수 있다.
create or replace function public.moonble_list_community_posts(
  p_scope text default 'all',
  p_token_hash text default null,
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
  share_row public.quiz_shares;
  viewer_id uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  page_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  post_items jsonb;
  post_total integer;
begin
  if p_scope = 'share' then
    share_row := public.moonble_active_quiz_share(p_token_hash);
    if share_row.id is null then
      raise exception 'Share not found' using errcode = 'P0002';
    end if;
  elsif p_scope in ('mine', 'liked') then
    if viewer_id is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
  elsif p_scope is distinct from 'all' then
    raise exception 'Invalid scope' using errcode = '22023';
  end if;

  select count(*)::integer into post_total
  from public.community_posts as post
  where post.deleted_at is null
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
      and (share_row.id is null or post.share_id = share_row.id)
      and (p_scope <> 'mine' or post.author_id = viewer_id)
      and (p_scope <> 'liked' or exists (select 1 from public.community_post_likes as liked where liked.post_id = post.id and liked.user_id = viewer_id))
    order by position
    offset page_offset
    limit page_size
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

create or replace function public.moonble_my_community_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'posts', (select count(*)::integer from public.community_posts as post where post.author_id = viewer_id and post.deleted_at is null),
    'comments', (
      select count(*)::integer from public.community_post_comments as comment
      join public.community_posts as post on post.id = comment.post_id
      where comment.author_id = viewer_id and comment.deleted_at is null and post.deleted_at is null
    ),
    'likes', (
      select count(*)::integer from public.community_post_likes as liked
      join public.community_posts as post on post.id = liked.post_id
      where liked.user_id = viewer_id and post.deleted_at is null
    )
  );
end;
$$;

-- 내가 쓴 댓글(원글 제목·본문 일부 포함, 최신순)
create or replace function public.moonble_list_my_community_comments(p_offset integer default 0, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  page_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  comment_items jsonb;
  comment_total integer;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select count(*)::integer into comment_total
  from public.community_post_comments as comment
  join public.community_posts as post on post.id = comment.post_id
  where comment.author_id = viewer_id and comment.deleted_at is null and post.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'body', item.body,
      'gif', item.gif,
      'like_count', item.like_count,
      'created_at', item.created_at,
      'post_title', item.post_title,
      'post_body', item.post_body,
      'post_author_name', coalesce(public.moonble_community_author_name(item.post_author_id), '문블 사용자')
    ) order by item.position), '[]'::jsonb)
    into comment_items
  from (
    select comment.id, comment.body, comment.gif, comment.like_count, comment.created_at,
      left(post.title, 60) as post_title, left(post.body, 80) as post_body, post.author_id as post_author_id,
      row_number() over (order by comment.created_at desc, comment.id desc) as position
    from public.community_post_comments as comment
    join public.community_posts as post on post.id = comment.post_id
    where comment.author_id = viewer_id and comment.deleted_at is null and post.deleted_at is null
    order by position
    offset page_offset
    limit page_size
  ) as item;

  return jsonb_build_object('comments', comment_items, 'total', comment_total);
end;
$$;

revoke all on function public.moonble_my_community_summary() from public, anon;
revoke all on function public.moonble_list_my_community_comments(integer, integer) from public, anon;
grant execute on function public.moonble_my_community_summary() to authenticated;
grant execute on function public.moonble_list_my_community_comments(integer, integer) to authenticated;

commit;
