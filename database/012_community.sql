-- 커뮤니티: 전체 피드 글·댓글·좋아요·신고와 문제지(공유 링크) 첨부, 풀이 기록 자랑을 저장합니다.
-- 006_quiz_share_rankings.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
-- 테이블은 직접 읽거나 쓸 수 없고 아래 RPC로만 접근합니다.
-- 목록·댓글 조회는 누구나, 작성·좋아요·신고는 로그인한 계정만 할 수 있습니다.
begin;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  topic text check (topic is null or topic in ('question', 'review', 'tip', 'error')),
  title text check (title is null or char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 2000),
  -- 첨부한 문제지: 작성자가 공개하기로 한 공유 링크와, 작성 시점의 문제지 요약
  share_id uuid references public.quiz_shares(id) on delete set null,
  share_token text check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{40,50}$'),
  attachment jsonb check (attachment is null or jsonb_typeof(attachment) = 'object'),
  -- 작성 시점의 내 기록(서버가 참여 기록으로 계산). 작성자가 자랑하기로 한 경우만 저장
  record jsonb check (record is null or jsonb_typeof(record) = 'object'),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_posts_latest_idx on public.community_posts (created_at desc) where deleted_at is null;
create index if not exists community_posts_popular_idx on public.community_posts (like_count desc, comment_count desc, created_at desc) where deleted_at is null;
create index if not exists community_posts_share_idx on public.community_posts (share_id, created_at desc) where deleted_at is null;
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists community_post_likes_user_idx on public.community_post_likes (user_id);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_post_comments_post_idx on public.community_post_comments (post_id, created_at) where deleted_at is null;
create index if not exists community_post_comments_author_idx on public.community_post_comments (author_id, created_at desc);

create table if not exists public.community_post_reports (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'spoiler', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;
alter table public.community_post_reports enable row level security;
revoke all on table public.community_posts, public.community_post_likes, public.community_post_comments, public.community_post_reports
  from public, anon, authenticated;

-- 활성 공유 링크만 찾는다. 공유 중지·원본 문제지 삭제 시 null.
create or replace function public.moonble_active_quiz_share(p_token_hash text)
returns public.quiz_shares
language sql
stable
security definer
set search_path = ''
as $$
  select share.*
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and share.token_hash = p_token_hash
    and share.revoked_at is null
    and bank.deleted_at is null
  limit 1;
$$;
revoke all on function public.moonble_active_quiz_share(text) from public, anon, authenticated;

-- 공개 표시 이름: 계정 이름만 노출하고 이메일 등 다른 정보는 내보내지 않는다.
create or replace function public.moonble_community_author_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(left(nullif(btrim(account.raw_user_meta_data ->> 'name'), ''), 24), '문블 사용자')
  from auth.users as account
  where account.id = p_user_id;
$$;
revoke all on function public.moonble_community_author_name(uuid) from public, anon, authenticated;

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
    'author_name', coalesce(public.moonble_community_author_name(p_post.author_id), '문블 사용자'),
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
    -- 작성자, 그리고 첨부된 문제지의 출제자는 글을 내릴 수 있다.
    'can_delete', p_viewer is not null and (p_post.author_id = p_viewer or coalesce(share.owner_id = p_viewer, false))
  )
  from (select 1) as anchor
  left join public.quiz_shares as share on share.id = p_post.share_id
  left join public.quiz_banks as bank on bank.id = share.bank_id;
$$;
revoke all on function public.moonble_community_post_json(public.community_posts, uuid) from public, anon, authenticated;

-- p_scope: 'all'(전체 피드) 또는 'share'(p_token_hash 공유 문제가 첨부된 글)
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
  elsif p_scope is distinct from 'all' then
    raise exception 'Invalid scope' using errcode = '22023';
  end if;

  select count(*)::integer into post_total
  from public.community_posts as post
  where post.deleted_at is null and (share_row.id is null or post.share_id = share_row.id);

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
    where post.deleted_at is null and (share_row.id is null or post.share_id = share_row.id)
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

-- p_share_token: 첨부할 공유 링크의 원래 토큰(작성자가 공개에 동의). 서버에서 해시해 활성 링크인지 확인한다.
-- p_participant_id·p_show_record: 그 공유 문제의 내 최고 점수와 순위를 함께 올릴지.
create or replace function public.moonble_create_community_post(
  p_topic text,
  p_title text,
  p_body text,
  p_share_token text default null,
  p_participant_id uuid default null,
  p_show_record boolean default false
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
  share_row public.quiz_shares;
  attachment_row jsonb;
  record_row jsonb;
  my_score integer;
  new_post public.community_posts;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(clean_body) not between 1 and 2000
    or (clean_title is not null and char_length(clean_title) > 60)
    or (clean_topic is not null and clean_topic not in ('question', 'review', 'tip', 'error')) then
    raise exception 'Invalid post' using errcode = '22023';
  end if;
  -- 짧은 시간에 반복 작성하는 것을 막는다.
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
    -- 썸네일용 요약: 제목·문항 수·첫 문항 지문 일부만 남긴다(정답은 저장하지 않는다).
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

  insert into public.community_posts (author_id, topic, title, body, share_id, share_token, attachment, record)
  values (requesting_user_id, clean_topic, clean_title, clean_body, share_row.id, case when share_row.id is not null then p_share_token end, attachment_row, record_row)
  returning * into new_post;

  return public.moonble_community_post_json(new_post, requesting_user_id);
end;
$$;

create or replace function public.moonble_delete_community_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.community_posts as post
  set deleted_at = now()
  where post.id = p_post_id
    and post.deleted_at is null
    and (post.author_id = requesting_user_id or exists (
      select 1 from public.quiz_shares as share where share.id = post.share_id and share.owner_id = requesting_user_id
    ));
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.moonble_toggle_community_post_like(p_post_id uuid)
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
  if not exists (select 1 from public.community_posts as post where post.id = p_post_id and post.deleted_at is null) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  delete from public.community_post_likes as liked
  where liked.post_id = p_post_id and liked.user_id = requesting_user_id;
  if found then
    now_liked := false;
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = p_post_id returning like_count into next_count;
  else
    insert into public.community_post_likes (post_id, user_id) values (p_post_id, requesting_user_id);
    now_liked := true;
    update public.community_posts set like_count = like_count + 1 where id = p_post_id returning like_count into next_count;
  end if;
  return jsonb_build_object('liked', now_liked, 'like_count', next_count);
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
      'author_name', coalesce(public.moonble_community_author_name(item.author_id), '문블 사용자'),
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

create or replace function public.moonble_create_community_post_comment(p_post_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  clean_body text := btrim(coalesce(p_body, ''));
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
  if char_length(clean_body) not between 1 and 500 then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;
  if (
    select count(*) from public.community_post_comments as recent
    where recent.author_id = requesting_user_id and recent.created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'Too many comments' using errcode = '54000';
  end if;

  insert into public.community_post_comments (post_id, author_id, body)
  values (p_post_id, requesting_user_id, clean_body)
  returning * into new_comment;
  update public.community_posts set comment_count = comment_count + 1 where id = p_post_id;

  return jsonb_build_object(
    'id', new_comment.id,
    'body', new_comment.body,
    'author_name', coalesce(public.moonble_community_author_name(requesting_user_id), '문블 사용자'),
    'is_share_owner', owner_id is not null and requesting_user_id = owner_id,
    'created_at', new_comment.created_at,
    'is_mine', true,
    'can_delete', true
  );
end;
$$;

create or replace function public.moonble_delete_community_post_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_post_id uuid;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.community_post_comments as comment
  set deleted_at = now()
  from public.community_posts as post
  where comment.id = p_comment_id
    and comment.deleted_at is null
    and post.id = comment.post_id
    and (comment.author_id = requesting_user_id or exists (
      select 1 from public.quiz_shares as share where share.id = post.share_id and share.owner_id = requesting_user_id
    ))
  returning comment.post_id into target_post_id;
  if target_post_id is null then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;
  update public.community_posts set comment_count = greatest(comment_count - 1, 0) where id = target_post_id;
end;
$$;

create or replace function public.moonble_report_community_post(p_post_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'spoiler', 'other') then
    raise exception 'Invalid reason' using errcode = '22023';
  end if;
  if not exists (select 1 from public.community_posts as post where post.id = p_post_id and post.deleted_at is null) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  insert into public.community_post_reports (post_id, reporter_id, reason)
  values (p_post_id, requesting_user_id, p_reason)
  on conflict (post_id, reporter_id) do nothing;
end;
$$;

revoke all on function public.moonble_list_community_posts(text, text, text, integer, integer) from public;
revoke all on function public.moonble_list_community_post_comments(uuid) from public;
grant execute on function public.moonble_list_community_posts(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.moonble_list_community_post_comments(uuid) to anon, authenticated;

revoke all on function public.moonble_create_community_post(text, text, text, text, uuid, boolean) from public, anon;
revoke all on function public.moonble_delete_community_post(uuid) from public, anon;
revoke all on function public.moonble_toggle_community_post_like(uuid) from public, anon;
revoke all on function public.moonble_create_community_post_comment(uuid, text) from public, anon;
revoke all on function public.moonble_delete_community_post_comment(uuid) from public, anon;
revoke all on function public.moonble_report_community_post(uuid, text) from public, anon;
grant execute on function public.moonble_create_community_post(text, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.moonble_delete_community_post(uuid) to authenticated;
grant execute on function public.moonble_toggle_community_post_like(uuid) to authenticated;
grant execute on function public.moonble_create_community_post_comment(uuid, text) to authenticated;
grant execute on function public.moonble_delete_community_post_comment(uuid) to authenticated;
grant execute on function public.moonble_report_community_post(uuid, text) to authenticated;

commit;
