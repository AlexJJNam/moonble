-- 커뮤니티 GIF 첨부(KLIPY)와 작성자 프로필 사진 표시.
-- 012_community.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 글·댓글 데이터는 바꾸거나 지우지 않습니다. gif 열을 추가하고 RPC 결과에 gif·프로필 사진 경로를 더합니다.
-- GIF 파일은 저장하지 않고 KLIPY가 준 URL과 메타데이터만 저장합니다(KLIPY 요구사항: URL을 그대로 사용, 재호스팅 금지).
begin;

alter table public.community_posts add column if not exists gif jsonb;
alter table public.community_post_comments add column if not exists gif jsonb;

-- 본문 없이 GIF만 남기는 것을 허용한다. 기존 행은 모두 본문이 있어 새 조건을 그대로 통과한다.
alter table public.community_posts drop constraint if exists community_posts_body_check;
alter table public.community_posts add constraint community_posts_body_check check (char_length(body) <= 2000);
alter table public.community_posts drop constraint if exists community_posts_content_check;
alter table public.community_posts add constraint community_posts_content_check check (char_length(body) >= 1 or gif is not null);
alter table public.community_posts drop constraint if exists community_posts_gif_check;
alter table public.community_posts add constraint community_posts_gif_check check (gif is null or jsonb_typeof(gif) = 'object');

alter table public.community_post_comments drop constraint if exists community_post_comments_body_check;
alter table public.community_post_comments add constraint community_post_comments_body_check check (char_length(body) <= 500);
alter table public.community_post_comments drop constraint if exists community_post_comments_content_check;
alter table public.community_post_comments add constraint community_post_comments_content_check check (char_length(body) >= 1 or gif is not null);
alter table public.community_post_comments drop constraint if exists community_post_comments_gif_check;
alter table public.community_post_comments add constraint community_post_comments_gif_check check (gif is null or jsonb_typeof(gif) = 'object');

-- 클라이언트가 보낸 GIF를 검증해 필요한 항목만 남긴다. KLIPY 미디어 도메인의 HTTPS URL만 허용한다.
create or replace function public.moonble_community_gif(p_gif jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  gif_id text;
  media_url text;
  preview_url text;
  gif_width integer;
  gif_height integer;
  gif_title text;
  media_prefix constant text := '^https://(static|static1|static2)\.klipy\.com/';
  unsafe_chars constant text := '[[:space:][:cntrl:]"''<>\\`^{}|]';
begin
  if p_gif is null or jsonb_typeof(p_gif) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_gif) <> 'object' or p_gif ->> 'provider' is distinct from 'klipy' then
    raise exception 'Invalid GIF' using errcode = '22023';
  end if;
  gif_id := p_gif ->> 'id';
  media_url := p_gif ->> 'url';
  preview_url := nullif(p_gif ->> 'preview_url', '');
  if gif_id is null or gif_id !~ '^[A-Za-z0-9_-]{1,120}$'
    or media_url is null or char_length(media_url) > 2048 or media_url !~ media_prefix or media_url ~ unsafe_chars
    or (preview_url is not null and (char_length(preview_url) > 2048 or preview_url !~ media_prefix or preview_url ~ unsafe_chars))
    or jsonb_typeof(p_gif -> 'width') is distinct from 'number'
    or jsonb_typeof(p_gif -> 'height') is distinct from 'number' then
    raise exception 'Invalid GIF' using errcode = '22023';
  end if;
  gif_width := round((p_gif ->> 'width')::numeric);
  gif_height := round((p_gif ->> 'height')::numeric);
  if gif_width not between 1 and 4096 or gif_height not between 1 and 4096 then
    raise exception 'Invalid GIF' using errcode = '22023';
  end if;
  gif_title := nullif(left(btrim(regexp_replace(coalesce(p_gif ->> 'title', ''), '[[:cntrl:]]', '', 'g')), 120), '');
  return jsonb_build_object('provider', 'klipy', 'id', gif_id, 'url', media_url, 'preview_url', preview_url,
    'width', gif_width, 'height', gif_height, 'title', gif_title);
end;
$$;
revoke all on function public.moonble_community_gif(jsonb) from public, anon, authenticated;

-- 작성자의 현재 프로필 사진 경로. 본인 폴더의 정상 파일 이름일 때만 돌려준다.
create or replace function public.moonble_community_author_avatar(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when profile.path ~* ('^' || p_user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$') then profile.path
  end
  from (select account.raw_user_meta_data ->> 'avatarPath' as path from auth.users as account where account.id = p_user_id) as profile;
$$;
revoke all on function public.moonble_community_author_avatar(uuid) from public, anon, authenticated;

-- 커뮤니티에 글이나 댓글이 남아 있는 사용자의 "현재" 프로필 사진만 다른 사람이 볼 수 있다.
-- 이전 사진 파일과 커뮤니티 활동이 없는 사용자의 사진은 계속 본인만 볼 수 있다.
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
        )
    )
    else false
  end;
$$;
revoke all on function public.moonble_community_avatar_visible(text) from public;
grant execute on function public.moonble_community_avatar_visible(text) to anon, authenticated;

drop policy if exists profile_avatars_select_community on storage.objects;
create policy profile_avatars_select_community on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-avatars' and public.moonble_community_avatar_visible(name));

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

-- 글 작성: p_gif를 추가한다(기본값 null이라 기존 클라이언트 호출도 그대로 동작한다).
drop function if exists public.moonble_create_community_post(text, text, text, text, uuid, boolean);
create or replace function public.moonble_create_community_post(
  p_topic text,
  p_title text,
  p_body text,
  p_share_token text default null,
  p_participant_id uuid default null,
  p_show_record boolean default false,
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
  share_row public.quiz_shares;
  attachment_row jsonb;
  record_row jsonb;
  my_score integer;
  new_post public.community_posts;
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
  if (
    select count(*) from public.community_posts as recent
    where recent.author_id = requesting_user_id and recent.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Too many posts' using errcode = '54000';
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
    if p_show_record and p_participant_id is not null then
      select participant.best_score into my_score
      from public.quiz_share_participants as participant
      where participant.share_id = share_row.id and participant.participant_id = p_participant_id;
      if my_score is not null then
        select jsonb_build_object(
          'score', my_score,
          'rank', 1 + count(*) filter (where participant.best_score > my_score),
          'participants', count(*)
        ) into record_row
        from public.quiz_share_participants as participant
        where participant.share_id = share_row.id;
      end if;
    end if;
  end if;

  insert into public.community_posts (author_id, topic, title, body, share_id, share_token, attachment, record, gif)
  values (requesting_user_id, clean_topic, clean_title, clean_body, share_row.id, case when share_row.id is not null then p_share_token end, attachment_row, record_row, clean_gif)
  returning * into new_post;

  return public.moonble_community_post_json(new_post, requesting_user_id);
end;
$$;

create or replace function public.moonble_list_community_post_comments(p_post_id uuid)
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
      'created_at', item.created_at,
      'is_mine', viewer_id is not null and item.author_id = viewer_id,
      'can_delete', viewer_id is not null and (item.author_id = viewer_id or coalesce(owner_id = viewer_id, false))
    ) order by item.created_at, item.id), '[]'::jsonb)
    into comment_items
  from (
    select comment.* from public.community_post_comments as comment
    where comment.post_id = p_post_id and comment.deleted_at is null
    order by comment.created_at, comment.id
    limit 200
  ) as item;
  return comment_items;
end;
$$;

-- 댓글 작성: p_gif를 추가한다(기본값 null이라 기존 클라이언트 호출도 그대로 동작한다).
drop function if exists public.moonble_create_community_post_comment(uuid, text);
create or replace function public.moonble_create_community_post_comment(p_post_id uuid, p_body text, p_gif jsonb default null)
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
  if char_length(clean_body) > 500 or (char_length(clean_body) = 0 and clean_gif is null) then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;
  if (
    select count(*) from public.community_post_comments as recent
    where recent.author_id = requesting_user_id and recent.created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'Too many comments' using errcode = '54000';
  end if;

  insert into public.community_post_comments (post_id, author_id, body, gif)
  values (p_post_id, requesting_user_id, clean_body, clean_gif)
  returning * into new_comment;
  update public.community_posts set comment_count = comment_count + 1 where id = p_post_id;

  return jsonb_build_object(
    'id', new_comment.id,
    'body', new_comment.body,
    'gif', new_comment.gif,
    'author_name', coalesce(public.moonble_community_author_name(requesting_user_id), '문블 사용자'),
    'author_avatar', public.moonble_community_author_avatar(requesting_user_id),
    'is_share_owner', owner_id is not null and requesting_user_id = owner_id,
    'created_at', new_comment.created_at,
    'is_mine', true,
    'can_delete', true
  );
end;
$$;

revoke all on function public.moonble_create_community_post(text, text, text, text, uuid, boolean, jsonb) from public, anon;
revoke all on function public.moonble_create_community_post_comment(uuid, text, jsonb) from public, anon;
grant execute on function public.moonble_create_community_post(text, text, text, text, uuid, boolean, jsonb) to authenticated;
grant execute on function public.moonble_create_community_post_comment(uuid, text, jsonb) to authenticated;

commit;
