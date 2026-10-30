-- 댓글에도 문제지 공유 링크를 첨부할 수 있도록 저장·조회 RPC를 확장합니다.
-- 028_public_quiz_author_avatars.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 댓글과 좋아요 데이터는 유지합니다.
begin;

alter table public.community_post_comments
  add column if not exists attachment jsonb,
  add column if not exists share_id uuid references public.quiz_shares(id) on delete set null,
  add column if not exists share_token text;

alter table public.community_post_comments
  add constraint community_post_comments_attachment_check
    check (attachment is null or jsonb_typeof(attachment) = 'object'),
  add constraint community_post_comments_share_token_check
    check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{40,50}$');

alter table public.community_post_comments drop constraint if exists community_post_comments_content_check;
alter table public.community_post_comments add constraint community_post_comments_content_check
  check (char_length(body) >= 1 or gif is not null or attachment is not null);

-- 댓글 목록에 첨부 문제지 요약과 현재 공유 링크 상태를 포함합니다.
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
      'attachment', case when item.attachment is null then null else item.attachment || jsonb_build_object(
        'active', share.id is not null and share.revoked_at is null and bank.deleted_at is null,
        'token', case when share.id is not null and share.revoked_at is null and bank.deleted_at is null then item.share_token end,
        'participants', (select count(*)::integer from public.quiz_share_participants as participant where participant.share_id = share.id),
        'average_score', (select round(avg(participant.best_score)::numeric, 1) from public.quiz_share_participants as participant where participant.share_id = share.id)
      ) end,
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
  ) as item
  left join public.quiz_shares as share on share.id = item.share_id
  left join public.quiz_banks as bank on bank.id = share.bank_id;
  return comment_items;
end;
$$;

-- 기존 두·세 인자 RPC를 교체해 PostgREST가 새 4인자 RPC를 명확히 선택하게 합니다.
drop function if exists public.moonble_create_community_post_comment(uuid, text);
drop function if exists public.moonble_create_community_post_comment(uuid, text, jsonb);
create function public.moonble_create_community_post_comment(
  p_post_id uuid,
  p_body text,
  p_gif jsonb default null,
  p_share_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  clean_body text := btrim(coalesce(p_body, ''));
  clean_gif jsonb := public.moonble_community_gif(p_gif);
  owner_id uuid;
  share_row public.quiz_shares;
  attachment_row jsonb;
  new_comment public.community_post_comments;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select share.owner_id into owner_id
  from public.community_posts as post
  left join public.quiz_shares as share on share.id = post.share_id
  where post.id = p_post_id and post.deleted_at is null;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if char_length(clean_body) > 500 then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;
  if p_share_token is not null then
    if p_share_token !~ '^[A-Za-z0-9_-]{40,50}$' then
      raise exception 'Invalid share token' using errcode = '22023';
    end if;
    share_row := public.moonble_active_quiz_share(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_share_token, 'UTF8')), 'hex'));
    if share_row.id is null then
      raise exception 'Share not found' using errcode = 'P0002';
    end if;
    attachment_row := jsonb_build_object(
      'title', left(coalesce(share_row.snapshot ->> 'title', '공유 문제'), 100),
      'question_count', coalesce(jsonb_array_length(case when jsonb_typeof(share_row.snapshot -> 'questions') = 'array' then share_row.snapshot -> 'questions' end), 0),
      'preview', left(coalesce(share_row.snapshot -> 'questions' -> 0 ->> 'q', ''), 80)
    );
  end if;
  if char_length(clean_body) = 0 and clean_gif is null and attachment_row is null then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;
  if (
    select count(*) from public.community_post_comments as recent
    where recent.author_id = requesting_user_id and recent.created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'Too many comments' using errcode = '54000';
  end if;

  insert into public.community_post_comments (post_id, author_id, body, gif, attachment, share_id, share_token)
  values (p_post_id, requesting_user_id, clean_body, clean_gif, attachment_row, share_row.id, case when share_row.id is not null then p_share_token end)
  returning * into new_comment;
  update public.community_posts set comment_count = comment_count + 1 where id = p_post_id;

  return jsonb_build_object(
    'id', new_comment.id,
    'body', new_comment.body,
    'gif', new_comment.gif,
    'attachment', case when share_row.id is null then null else attachment_row || jsonb_build_object(
      'active', true,
      'token', p_share_token,
      'participants', (select count(*)::integer from public.quiz_share_participants as participant where participant.share_id = share_row.id),
      'average_score', (select round(avg(participant.best_score)::numeric, 1) from public.quiz_share_participants as participant where participant.share_id = share_row.id)
    ) end,
    'author_name', coalesce(public.moonble_community_author_name(requesting_user_id), '문블 사용자'),
    'author_avatar', public.moonble_community_author_avatar(requesting_user_id),
    'is_share_owner', owner_id is not null and requesting_user_id = owner_id,
    'like_count', 0,
    'liked', false,
    'created_at', new_comment.created_at,
    'is_mine', true,
    'can_delete', true
  );
end;
$$;

revoke all on function public.moonble_list_community_post_comments(uuid, text) from public;
revoke all on function public.moonble_create_community_post_comment(uuid, text, jsonb, text) from public, anon;
grant execute on function public.moonble_list_community_post_comments(uuid, text) to anon, authenticated;
grant execute on function public.moonble_create_community_post_comment(uuid, text, jsonb, text) to authenticated;

commit;
