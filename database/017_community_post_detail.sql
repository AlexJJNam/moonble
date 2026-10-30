-- 마이페이지 "작성한 댓글"에서 글 상세를 열 수 있게 한다.
-- 1) 글 하나를 피드와 같은 형태로 불러오는 RPC
-- 2) 내 댓글 목록에 글 id(post_id)를 함께 돌려준다.
-- 테이블·데이터는 바꾸지 않는다. 다시 실행해도 안전하다.

create or replace function public.moonble_get_community_post(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  post_row public.community_posts;
begin
  select * into post_row
  from public.community_posts as post
  where post.id = p_post_id and post.deleted_at is null;
  if post_row.id is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  return public.moonble_community_post_json(post_row, auth.uid());
end;
$$;

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
      'post_id', item.post_id,
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
    select comment.id, comment.post_id, comment.body, comment.gif, comment.like_count, comment.created_at,
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

revoke all on function public.moonble_get_community_post(uuid) from public;
grant execute on function public.moonble_get_community_post(uuid) to anon, authenticated;
revoke all on function public.moonble_list_my_community_comments(integer, integer) from public, anon;
grant execute on function public.moonble_list_my_community_comments(integer, integer) to authenticated;
