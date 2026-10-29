-- 커뮤니티 글 편집, 댓글 좋아요·인기순 정렬.
-- 013_community_gif_avatars.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 글·댓글은 바꾸거나 지우지 않습니다. 열을 추가하고 함수를 추가·확장합니다(기존 호출 방식도 그대로 동작).
begin;

alter table public.community_posts add column if not exists edited_at timestamptz;
alter table public.community_post_comments add column if not exists like_count integer not null default 0 check (like_count >= 0);

create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists community_comment_likes_user_idx on public.community_comment_likes (user_id);
alter table public.community_comment_likes enable row level security;
revoke all on table public.community_comment_likes from public, anon, authenticated;

-- 글 JSON에 수정 시각을 더한다.
create or replace function public.moonble_community_post_json(p_post public.community_posts, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_post.id,
    'topic', p_post.topic,
    'title', p_post.title,
    'body', p_post.body,
    'gif', p_post.gif,
    'author_name', coalesce(public.moonble_community_author_name(p_post.author_id), '문블 사용자'),
    'author_avatar', public.moonble_community_author_avatar(p_post.author_id),
    'is_share_owner', share.owner_id is not null and p_post.author_id = share.owner_id,
    'record', p_post.record,
    'attachment', case when p_post.attachment is null then null else p_post.attachment || jsonb_build_object(
      'active', share.id is not null and share.revoked_at is null and bank.deleted_at is null,
      'token', case when share.id is not null and share.revoked_at is null and bank.deleted_at is null then p_post.share_token end,
      'participants', (select count(*)::integer from public.quiz_share_participants as participant where participant.share_id = share.id),
      'average_score', (select round(avg(participant.best_score)::numeric, 1) from public.quiz_share_participants as participant where participant.share_id = share.id)
    ) end,
    'like_count', p_post.like_count,
    'comment_count', p_post.comment_count,
    'created_at', p_post.created_at,
    'edited_at', p_post.edited_at,
    'liked', p_viewer is not null and exists (
      select 1 from public.community_post_likes as liked where liked.post_id = p_post.id and liked.user_id = p_viewer
    ),
    'is_mine', p_viewer is not null and p_post.author_id = p_viewer,
    'can_delete', p_viewer is not null and (p_post.author_id = p_viewer or coalesce(share.owner_id = p_viewer, false))
  )
  from (select 1) as anchor
  left join public.quiz_shares as share on share.id = p_post.share_id
  left join public.quiz_banks as bank on bank.id = share.bank_id;
$$;
revoke all on function public.moonble_community_post_json(public.community_posts, uuid) from public, anon, authenticated;

-- 글 편집: 작성자 본인만. 주제·제목·본문·GIF를 바꾼다(첨부한 문제지와 기록은 그대로).
create or replace function public.moonble_update_community_post(
  p_post_id uuid,
  p_topic text,
  p_title text,
  p_body text,
  p_gif jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  clean_title text := nullif(btrim(coalesce(p_title, '')), '');
  clean_body text := btrim(coalesce(p_body, ''));
  clean_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  clean_gif jsonb := public.moonble_community_gif(p_gif);
  updated_post public.community_posts;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(clean_body) > 2000
    or (char_length(clean_body) = 0 and clean_gif is null)
    or (clean_title is not null and char_length(clean_title) > 60)
    or (clean_topic is not null and clean_topic not in ('question', 'review', 'tip', 'error')) then
    raise exception 'Invalid post' using errcode = '22023';
  end if;
  update public.community_posts as post
  set topic = clean_topic, title = clean_title, body = clean_body, gif = clean_gif, edited_at = now()
  where post.id = p_post_id and post.author_id = requesting_user_id and post.deleted_at is null
  returning * into updated_post;
  if updated_post.id is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  return public.moonble_community_post_json(updated_post, requesting_user_id);
end;
$$;

create or replace function public.moonble_toggle_community_comment_like(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  now_liked boolean;
  next_count integer;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_post_comments as comment
    join public.community_posts as post on post.id = comment.post_id
    where comment.id = p_comment_id and comment.deleted_at is null and post.deleted_at is null
  ) then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;
  delete from public.community_comment_likes as liked
  where liked.comment_id = p_comment_id and liked.user_id = requesting_user_id;
  if found then
    now_liked := false;
    update public.community_post_comments set like_count = greatest(like_count - 1, 0) where id = p_comment_id returning like_count into next_count;
  else
    insert into public.community_comment_likes (comment_id, user_id) values (p_comment_id, requesting_user_id);
    now_liked := true;
    update public.community_post_comments set like_count = like_count + 1 where id = p_comment_id returning like_count into next_count;
  end if;
  return jsonb_build_object('liked', now_liked, 'like_count', next_count);
end;
$$;

-- 댓글 목록: 좋아요 수·내 좋아요를 더하고 정렬(popular|latest)을 받는다. p_sort 기본값이 있어 기존 호출도 동작한다.
drop function if exists public.moonble_list_community_post_comments(uuid);
create or replace function public.moonble_list_community_post_comments(p_post_id uuid, p_sort text default 'popular')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  owner_id uuid;
  comment_items jsonb;
begin
  select share.owner_id into owner_id
  from public.community_posts as post
  left join public.quiz_shares as share on share.id = post.share_id
  where post.id = p_post_id and post.deleted_at is null;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'body', item.body,
      'gif', item.gif,
      'author_name', coalesce(public.moonble_community_author_name(item.author_id), '문블 사용자'),
      'author_avatar', public.moonble_community_author_avatar(item.author_id),
      'is_share_owner', owner_id is not null and item.author_id = owner_id,
      'like_count', item.like_count,
      'liked', viewer_id is not null and exists (
        select 1 from public.community_comment_likes as liked where liked.comment_id = item.id and liked.user_id = viewer_id
      ),
      'created_at', item.created_at,
      'is_mine', viewer_id is not null and item.author_id = viewer_id,
      'can_delete', viewer_id is not null and (item.author_id = viewer_id or coalesce(owner_id = viewer_id, false))
    ) order by item.position), '[]'::jsonb)
    into comment_items
  from (
    select comment.*, row_number() over (
      order by
        case when p_sort = 'latest' then null else comment.like_count end desc nulls last,
        case when p_sort = 'latest' then comment.created_at end desc,
        case when p_sort = 'latest' then null else comment.created_at end asc,
        comment.id
    ) as position
    from public.community_post_comments as comment
    where comment.post_id = p_post_id and comment.deleted_at is null
    order by position
    limit 200
  ) as item;
  return comment_items;
end;
$$;

revoke all on function public.moonble_update_community_post(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.moonble_toggle_community_comment_like(uuid) from public, anon;
revoke all on function public.moonble_list_community_post_comments(uuid, text) from public;
grant execute on function public.moonble_update_community_post(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.moonble_toggle_community_comment_like(uuid) to authenticated;
grant execute on function public.moonble_list_community_post_comments(uuid, text) to anon, authenticated;

commit;
