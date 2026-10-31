-- 커뮤니티 글·댓글에 사용자가 GIF/JPG/PNG를 첨부하고,
-- 공개 문제의 커스텀 썸네일을 문제 찾기에서도 볼 수 있게 합니다.
-- 030_quiz_custom_thumbnails.sql 이후 Supabase SQL Editor에서 한 번 실행합니다.
begin;

alter table public.quiz_bank_thumbnails
  add column if not exists provider text not null default 'upload',
  add column if not exists media jsonb;
alter table public.quiz_bank_thumbnails alter column object_path drop not null;
alter table public.quiz_bank_thumbnails drop constraint if exists quiz_bank_thumbnails_path_owner;
alter table public.quiz_bank_thumbnails add constraint quiz_bank_thumbnails_path_owner check (
  (provider = 'upload' and object_path is not null and split_part(object_path, '/', 1) = owner_id::text)
  or (provider = 'klipy' and object_path is null)
);
alter table public.quiz_bank_thumbnails drop constraint if exists quiz_bank_thumbnails_media_check;
alter table public.quiz_bank_thumbnails add constraint quiz_bank_thumbnails_media_check check (
  (provider = 'upload' and media is null)
  or (
    provider = 'klipy'
    and jsonb_typeof(media) = 'object'
    and media ->> 'provider' = 'klipy'
    and (media ->> 'id') ~ '^[A-Za-z0-9_-]{1,120}$'
    and (media ->> 'url') ~ '^https://(static|static1|static2)\.klipy\.com/'
    and (media ->> 'url') !~ '[[:space:][:cntrl:]"''<>\\`^{}|]'
    and jsonb_typeof(media -> 'width') = 'number'
    and jsonb_typeof(media -> 'height') = 'number'
    and case when jsonb_typeof(media -> 'width') = 'number' then (media ->> 'width')::numeric between 1 and 4096 else false end
    and case when jsonb_typeof(media -> 'height') = 'number' then (media ->> 'height')::numeric between 1 and 4096 else false end
    and (nullif(media ->> 'preview_url', '') is null or (
      (media ->> 'preview_url') ~ '^https://(static|static1|static2)\.klipy\.com/'
      and (media ->> 'preview_url') !~ '[[:space:][:cntrl:]"''<>\\`^{}|]'
    ))
  )
);

-- 커뮤니티 첨부는 공개 글·댓글에 표시되므로 공개 조회 버킷을 사용합니다.
-- 업로드/삭제는 로그인한 사용자의 폴더에만 허용합니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', true, 5242880, array['image/gif', 'image/jpeg', 'image/png']::text[])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_media_insert_own on storage.objects;
create policy community_media_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-media'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\.(gif|jpg|png)$'
  );
drop policy if exists community_media_delete_own on storage.objects;
create policy community_media_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'community-media' and split_part(name, '/', 1) = (select auth.uid())::text
  );

-- URL은 DB에 그대로 신뢰해 저장하지 않습니다. 업로드 경로와 실제 Storage 객체를 확인하고
-- 클라이언트는 검증된 경로로부터 공개 URL을 다시 만듭니다. KLIPY 원본 URL 처리는 유지합니다.
create or replace function public.moonble_community_gif(p_gif jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  provider text;
  gif_id text;
  media_url text;
  preview_url text;
  gif_width integer;
  gif_height integer;
  gif_title text;
  requesting_user_id uuid := auth.uid();
  media_prefix constant text := '^https://(static|static1|static2)\.klipy\.com/';
  unsafe_chars constant text := '[[:space:][:cntrl:]"''<>\\`^{}|]';
begin
  if p_gif is null or jsonb_typeof(p_gif) = 'null' then return null; end if;
  if jsonb_typeof(p_gif) <> 'object' then
    raise exception 'Invalid media' using errcode = '22023';
  end if;
  provider := p_gif ->> 'provider';
  gif_id := p_gif ->> 'id';
  preview_url := nullif(p_gif ->> 'preview_url', '');
  gif_title := nullif(left(btrim(regexp_replace(coalesce(p_gif ->> 'title', ''), '[[:cntrl:]]', '', 'g')), 120), '');
  if jsonb_typeof(p_gif -> 'width') is distinct from 'number'
    or jsonb_typeof(p_gif -> 'height') is distinct from 'number' then
    raise exception 'Invalid media' using errcode = '22023';
  end if;
  gif_width := round((p_gif ->> 'width')::numeric);
  gif_height := round((p_gif ->> 'height')::numeric);
  if gif_width not between 1 and 4096 or gif_height not between 1 and 4096 then
    raise exception 'Invalid media' using errcode = '22023';
  end if;

  if provider = 'klipy' then
    media_url := p_gif ->> 'url';
    if gif_id is null or gif_id !~ '^[A-Za-z0-9_-]{1,120}$'
      or media_url is null or char_length(media_url) > 2048 or media_url !~ media_prefix or media_url ~ unsafe_chars
      or (preview_url is not null and (char_length(preview_url) > 2048 or preview_url !~ media_prefix or preview_url ~ unsafe_chars)) then
      raise exception 'Invalid GIF' using errcode = '22023';
    end if;
    return jsonb_build_object('provider', 'klipy', 'id', gif_id, 'url', media_url, 'preview_url', preview_url,
      'width', gif_width, 'height', gif_height, 'title', gif_title);
  elsif provider = 'upload' then
    if requesting_user_id is null
      or gif_id is null
      or gif_id !~* ('^' || requesting_user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(gif|jpg|png)$')
      or not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'community-media' and object.name = gif_id
      ) then
      raise exception 'Invalid uploaded media' using errcode = '22023';
    end if;
    return jsonb_build_object('provider', 'upload', 'id', gif_id, 'width', gif_width,
      'height', gif_height, 'title', gif_title);
  end if;
  raise exception 'Invalid media provider' using errcode = '22023';
end;
$$;
revoke all on function public.moonble_community_gif(jsonb) from public, anon, authenticated;

-- 비공개 썸네일 버킷은 그대로 유지하되, 현재 공개로 게시된 문제의 경로만
-- 서명 URL을 발급할 수 있도록 읽기 정책을 추가합니다.
create or replace function public.moonble_public_quiz_thumbnail_visible(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiz_bank_thumbnails as thumbnail
    join public.quiz_banks as bank on bank.id = thumbnail.bank_id and bank.owner_id = thumbnail.owner_id
    join public.quiz_shares as share on share.bank_id = bank.id and share.owner_id = bank.owner_id
    where thumbnail.object_path = p_object_name
      and bank.deleted_at is null
      and share.id = (
        select latest.id
        from public.quiz_shares as latest
        where latest.bank_id = bank.id and latest.owner_id = bank.owner_id
        order by latest.created_at desc
        limit 1
      )
      and share.visibility = 'public'
      and share.revoked_at is null
      and share.public_token is not null
  );
$$;
revoke all on function public.moonble_public_quiz_thumbnail_visible(text) from public;
grant execute on function public.moonble_public_quiz_thumbnail_visible(text) to anon, authenticated;

drop policy if exists quiz_thumbnails_read_public on storage.objects;
create policy quiz_thumbnails_read_public on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'quiz-thumbnails' and public.moonble_public_quiz_thumbnail_visible(name)
  );

-- 공개 문제 목록 응답에 문제지 소유자의 썸네일 경로를 포함합니다.
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
      'thumbnail_path', (select thumbnail.object_path from public.quiz_bank_thumbnails as thumbnail where thumbnail.bank_id = page.bank_id and thumbnail.owner_id = page.owner_id),
      'thumbnail_media', (select thumbnail.media from public.quiz_bank_thumbnails as thumbnail where thumbnail.bank_id = page.bank_id and thumbnail.owner_id = page.owner_id and thumbnail.provider = 'klipy'),
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

commit;
