-- 공개 문제지 인기순·급상승을 최근 활동으로 계산합니다.
-- 033_public_quiz_card_actions.sql 적용 후 Supabase SQL Editor에서 한 번 실행합니다.
-- 이벤트가 없는 과거 누적 수치는 소급해서 만들지 않습니다.
begin;

create table if not exists public.quiz_public_activity_events (
  id bigint generated always as identity primary key,
  bank_id text not null references public.quiz_banks(id) on delete cascade,
  kind text not null check (kind in ('view', 'start', 'complete', 'bookmark')),
  actor_key text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index if not exists quiz_public_activity_events_time_idx on public.quiz_public_activity_events (occurred_at desc, bank_id);
create index if not exists quiz_public_activity_events_bank_time_idx on public.quiz_public_activity_events (bank_id, occurred_at desc);
create index if not exists quiz_public_activity_events_actor_idx on public.quiz_public_activity_events (bank_id, actor_key, kind, occurred_at desc);
create unique index if not exists quiz_public_activity_first_bookmark_idx
  on public.quiz_public_activity_events (bank_id, kind, actor_key) where kind = 'bookmark';
alter table public.quiz_public_activity_events enable row level security;
revoke all on table public.quiz_public_activity_events from public, anon, authenticated;
create table if not exists public.quiz_public_activity_completion_keys (
  submission_id uuid primary key,
  bank_id text not null references public.quiz_banks(id) on delete cascade,
  first_seen_at timestamptz not null default now()
);
alter table public.quiz_public_activity_completion_keys enable row level security;
revoke all on table public.quiz_public_activity_completion_keys from public, anon, authenticated;

-- 운영 가중치는 별도 설정 행으로 관리합니다.
create table if not exists public.quiz_public_activity_weights (
  kind text primary key check (kind in ('view', 'start', 'complete', 'bookmark')),
  weight numeric(6,2) not null check (weight >= 0),
  updated_at timestamptz not null default now()
);
insert into public.quiz_public_activity_weights (kind, weight) values
  ('view', 0.10), ('start', 1.00), ('complete', 3.00), ('bookmark', 2.00)
on conflict (kind) do nothing;
alter table public.quiz_public_activity_weights enable row level security;
revoke all on table public.quiz_public_activity_weights from public, anon, authenticated;

create table if not exists public.quiz_public_ranking_cache (
  bank_id text primary key references public.quiz_banks(id) on delete cascade,
  popular_score numeric(12,2) not null default 0,
  popular_participant_count integer not null default 0,
  recent_score numeric(12,2) not null default 0,
  previous_score numeric(12,2) not null default 0,
  recent_event_count integer not null default 0,
  recent_participant_count integer not null default 0,
  refreshed_at timestamptz not null default now()
);
alter table public.quiz_public_ranking_cache add column if not exists popular_participant_count integer not null default 0;
alter table public.quiz_public_ranking_cache enable row level security;
revoke all on table public.quiz_public_ranking_cache from public, anon, authenticated;
create table if not exists public.quiz_public_ranking_refresh_state (
  singleton boolean primary key default true check (singleton),
  refreshed_at timestamptz
);
insert into public.quiz_public_ranking_refresh_state (singleton, refreshed_at) values (true, null)
on conflict (singleton) do nothing;
alter table public.quiz_public_ranking_refresh_state enable row level security;
revoke all on table public.quiz_public_ranking_refresh_state from public, anon, authenticated;
create table if not exists public.community_post_ranking_cache (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  popular_likes integer not null default 0,
  recent_likes integer not null default 0,
  previous_likes integer not null default 0,
  recent_people integer not null default 0,
  refreshed_at timestamptz not null default now()
);
alter table public.community_post_ranking_cache enable row level security;
revoke all on table public.community_post_ranking_cache from public, anon, authenticated;

-- 서버에서만 이벤트를 기록하고, actor/problem/kind별 24시간 중복을 막습니다.
create or replace function public.moonble_record_public_quiz_activity(
  p_bank_id text, p_kind text, p_actor_key text, p_actor_user_id uuid default null, p_source_event_id uuid default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_bank_id is null or p_kind is null or p_kind not in ('view', 'start', 'complete') or p_actor_key is null or length(p_actor_key) > 80
    or (p_kind = 'complete' and p_source_event_id is null) then
    raise exception 'Invalid public quiz activity' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bank_id || ':' || p_actor_key || ':' || p_kind, 0));
  if p_kind = 'complete' then
    insert into public.quiz_public_activity_completion_keys (submission_id, bank_id)
    values (p_source_event_id, p_bank_id)
    on conflict (submission_id) do nothing;
    if not found then return false; end if;
  end if;
  if exists (
    select 1 from public.quiz_public_activity_events as event
    where event.bank_id = p_bank_id and event.kind = p_kind and event.actor_key = p_actor_key
      and event.occurred_at >= now() - interval '24 hours'
  ) then return false; end if;
  insert into public.quiz_public_activity_events (bank_id, kind, actor_key, actor_user_id)
  values (p_bank_id, p_kind, p_actor_key, p_actor_user_id);
  return true;
end;
$$;
revoke all on function public.moonble_record_public_quiz_activity(text,text,text,uuid,uuid) from public, anon, authenticated;

-- 조회와 풀이 시작은 로그인한 외부 이용자만 기록합니다. 점수·횟수는 입력받지 않습니다.
create or replace function public.moonble_track_public_quiz_activity(p_token text, p_kind text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_bank_id text;
  target_owner_id uuid;
begin
  if requesting_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind not in ('view', 'start') or p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid public quiz activity' using errcode = '22023';
  end if;
  select share.bank_id, share.owner_id into target_bank_id, target_owner_id
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.public_token = p_token and share.visibility = 'public'
    and share.revoked_at is null and bank.deleted_at is null
  order by share.created_at desc, share.id desc limit 1;
  if target_bank_id is null then raise exception 'Public quiz not found' using errcode = 'P0002'; end if;
  if target_owner_id = requesting_user_id then return false; end if;
  return public.moonble_record_public_quiz_activity(target_bank_id, p_kind, 'user:' || requesting_user_id::text, requesting_user_id);
end;
$$;
revoke all on function public.moonble_track_public_quiz_activity(text,text) from public, anon, authenticated;
grant execute on function public.moonble_track_public_quiz_activity(text,text) to authenticated;

-- 기존 좋아요 API를 유지하면서 문제지별 첫 신규 등록만 한 번 가산합니다.
create or replace function public.moonble_set_public_quiz_like(p_token text, p_liked boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  target_bank_id text;
  old_liked boolean;
  total integer;
begin
  if requesting_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,50}$' or p_liked is null then
    raise exception 'Invalid like' using errcode = '22023';
  end if;
  select share.bank_id into target_bank_id
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.public_token = p_token and share.visibility = 'public'
    and share.revoked_at is null and bank.deleted_at is null
  order by share.created_at desc, share.id desc limit 1 for share of share, bank;
  if target_bank_id is null then raise exception 'Public quiz not found' using errcode = 'P0002'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-quiz-like:' || target_bank_id || ':' || requesting_user_id::text, 0));
  select liked.liked into old_liked from public.quiz_public_likes as liked
  where liked.bank_id = target_bank_id and liked.user_id = requesting_user_id for update;
  insert into public.quiz_public_likes as existing (bank_id, user_id, liked) values (target_bank_id, requesting_user_id, p_liked)
  on conflict (bank_id, user_id) do update set
    liked = excluded.liked,
    created_at = case when excluded.liked and not existing.liked then now() else existing.created_at end;
  if p_liked and not coalesce(old_liked, false) then
    insert into public.quiz_public_activity_events (bank_id, kind, actor_key, actor_user_id)
    values (target_bank_id, 'bookmark', 'user:' || requesting_user_id::text, requesting_user_id)
    on conflict (bank_id, kind, actor_key) where kind = 'bookmark' do nothing;
  end if;
  select count(*)::integer into total from public.quiz_public_likes as liked where liked.bank_id = target_bank_id and liked.liked;
  return jsonb_build_object('liked', p_liked, 'like_count', total);
end;
$$;
revoke all on function public.moonble_set_public_quiz_like(text,boolean) from public, anon, authenticated;
grant execute on function public.moonble_set_public_quiz_like(text,boolean) to authenticated;

-- 검증된 공유 풀이 제출만 완료 활동으로 기록합니다. 클라이언트 점수는 사용하지 않습니다.
do $$
declare
  definition text;
  old_block text := $old$    total_count = excluded.total_count,
    updated_at = greatest(current_participant.updated_at, excluded.updated_at);

  select participant.best_score$old$;
  new_block text := $new$    total_count = excluded.total_count,
    updated_at = greatest(current_participant.updated_at, excluded.updated_at);

  if share_row.visibility = 'public' and share_row.owner_id is distinct from auth.uid() then
    perform public.moonble_record_public_quiz_activity(
      share_row.bank_id, 'complete',
      case when auth.uid() is not null then 'user:' || auth.uid()::text else 'participant:' || p_participant_id::text end,
      auth.uid(), submission_row.submission_id
    );
  end if;

  select participant.best_score$new$;
begin
  definition := pg_catalog.pg_get_functiondef('public.moonble_get_quiz_share_rank(text,uuid,uuid)'::regprocedure);
  if position(old_block in definition) = 0 then raise exception 'Could not extend quiz share ranking RPC'; end if;
  execute replace(definition, old_block, new_block);
end;
$$;

-- 문제지와 커뮤니티 인기 집계를 1시간 캐시합니다. pg_cron 없이 목록 호출 시 오래된 캐시를 갱신합니다.
create or replace function public.moonble_refresh_public_quiz_rankings()
returns void language plpgsql security definer set search_path = ''
as $$
declare last_refresh timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('moonble-public-quiz-ranking-refresh', 0));
  select refreshed_at into last_refresh from public.quiz_public_ranking_refresh_state where singleton for update;
  if last_refresh is not null and last_refresh >= now() - interval '1 hour' then return; end if;

  delete from public.quiz_public_ranking_cache as cache
  where not exists (select 1 from public.quiz_public_activity_events as event
    where event.bank_id = cache.bank_id and event.occurred_at >= now() - interval '7 days');
  insert into public.quiz_public_ranking_cache (
    bank_id, popular_score, popular_participant_count, recent_score, previous_score, recent_event_count, recent_participant_count, refreshed_at
  )
  select event.bank_id,
    coalesce(sum(weight.weight) filter (where event.occurred_at >= now() - interval '7 days'), 0),
    count(distinct event.actor_key) filter (where event.occurred_at >= now() - interval '7 days')::integer,
    coalesce(sum(weight.weight) filter (where event.occurred_at >= now() - interval '72 hours'), 0),
    coalesce(sum(weight.weight) filter (where event.occurred_at >= now() - interval '144 hours'
      and event.occurred_at < now() - interval '72 hours'), 0),
    count(*) filter (where event.occurred_at >= now() - interval '72 hours')::integer,
    count(distinct event.actor_key) filter (where event.occurred_at >= now() - interval '72 hours')::integer,
    now()
  from public.quiz_public_activity_events as event
  join public.quiz_public_activity_weights as weight on weight.kind = event.kind
  where event.occurred_at >= now() - interval '7 days'
  group by event.bank_id
  on conflict (bank_id) do update set
    popular_score = excluded.popular_score, popular_participant_count = excluded.popular_participant_count,
    recent_score = excluded.recent_score,
    previous_score = excluded.previous_score, recent_event_count = excluded.recent_event_count,
    recent_participant_count = excluded.recent_participant_count, refreshed_at = excluded.refreshed_at;
  update public.quiz_public_ranking_refresh_state set refreshed_at = now() where singleton;
  delete from public.community_post_ranking_cache as cache
  where not exists (select 1 from public.community_post_likes as liked
    where liked.post_id = cache.post_id and liked.created_at >= now() - interval '7 days');
  insert into public.community_post_ranking_cache (
    post_id, popular_likes, recent_likes, previous_likes, recent_people, refreshed_at
  )
  select liked.post_id,
    count(*) filter (where liked.created_at >= now() - interval '7 days')::integer,
    count(*) filter (where liked.created_at >= now() - interval '72 hours')::integer,
    count(*) filter (where liked.created_at >= now() - interval '144 hours'
      and liked.created_at < now() - interval '72 hours')::integer,
    count(distinct liked.user_id) filter (where liked.created_at >= now() - interval '72 hours')::integer,
    now()
  from public.community_post_likes as liked
  where liked.created_at >= now() - interval '7 days'
  group by liked.post_id
  on conflict (post_id) do update set
    popular_likes = excluded.popular_likes, recent_likes = excluded.recent_likes,
    previous_likes = excluded.previous_likes, recent_people = excluded.recent_people,
    refreshed_at = excluded.refreshed_at;
  delete from public.quiz_public_activity_events
  where occurred_at < now() - interval '8 days' and kind <> 'bookmark';
end;
$$;
revoke all on function public.moonble_refresh_public_quiz_rankings() from public, anon, authenticated;

-- 기존 검색 결과 필드·공개 권한을 유지하고 정렬을 7일/72시간 서버 집계로 교체합니다.
do $$
declare
  definition text;
  stats_old text := $old$      (select count(*)::integer from public.community_posts as post where post.share_id = matched.id and post.deleted_at is null) as post_count
    from matched
  )$old$;
  stats_new text := $new$      (select count(*)::integer from public.community_posts as post where post.share_id = matched.id and post.deleted_at is null) as post_count,
      coalesce(ranking.popular_score, 0)::numeric as popular_score,
      coalesce(ranking.popular_participant_count, 0)::integer as popular_participant_count,
      coalesce(ranking.recent_score, 0)::numeric as recent_score,
      coalesce(ranking.previous_score, 0)::numeric as previous_score,
      coalesce(ranking.recent_score, 0)::numeric - coalesce(ranking.previous_score, 0)::numeric as trend_score,
      coalesce(ranking.recent_event_count, 0)::integer as recent_event_count,
      coalesce(ranking.recent_participant_count, 0)::integer as recent_participant_count
    from matched
    left join public.quiz_public_ranking_cache as ranking on ranking.bank_id = matched.bank_id
  )$new$;
  order_old text := $oldorder$        case when p_sort = 'latest' then null else stats.participants end desc nulls last,
        case when p_sort = 'latest' then null else stats.post_count end desc nulls last,
        stats.published_at desc nulls last,$oldorder$;
  order_new text := $neworder$        case when p_sort = 'trending' and stats.recent_event_count >= 3 and stats.recent_participant_count >= 2 then 1 else 0 end desc,
        case when p_sort = 'popular' then stats.popular_score end desc nulls last,
        case when p_sort = 'trending' then stats.trend_score end desc nulls last,
        case when p_sort = 'trending' then stats.recent_score end desc nulls last,
        case when p_sort = 'popular' then stats.popular_participant_count end desc nulls last,
        case when p_sort = 'trending' then stats.recent_participant_count end desc nulls last,
        stats.published_at desc nulls last,$neworder$;
begin
  definition := pg_catalog.pg_get_functiondef('public.moonble_list_public_quizzes(text,text,integer,integer,text,text[])'::regprocedure);
  if position(stats_old in definition) = 0 or position(order_old in definition) = 0 then
    raise exception 'Could not extend public quiz list RPC; apply the latest base migration first';
  end if;
  definition := regexp_replace(definition, E'\n[[:space:]]*STABLE[[:space:]]*\n', E'\n VOLATILE\n', 'i');
  definition := replace(definition, $start$begin
  if p_tokens$start$, $refresh$begin
  if coalesce(p_sort, 'popular') <> 'latest' then
    perform public.moonble_refresh_public_quiz_rankings();
  end if;
  if p_tokens$refresh$);
  definition := replace(definition, stats_old, stats_new);
  definition := replace(definition,
    $json$      'post_count', page.post_count,
      'published_at', page.published_at,$json$,
    $jsonnew$      'post_count', page.post_count,
      'popularity_score', page.popular_score,
      'trending_score', page.trend_score,
      'recent_activity_score', page.recent_score,
      'published_at', page.published_at,$jsonnew$);
  definition := replace(definition, order_old, order_new);
  if position('moonble_refresh_public_quiz_rankings' in definition) = 0 or position('stats.trend_score' in definition) = 0 then
    raise exception 'Public quiz ranking update did not apply';
  end if;
  execute definition;
end;
$$;
revoke all on function public.moonble_list_public_quizzes(text,text,integer,integer,text,text[]) from public;
grant execute on function public.moonble_list_public_quizzes(text,text,integer,integer,text,text[]) to anon, authenticated;

-- 커뮤니티 글은 댓글 수를 인기 지표에서 제외합니다. 최근 좋아요만 사용합니다.
create index if not exists community_post_likes_post_time_idx on public.community_post_likes (post_id, created_at desc, user_id);
create index if not exists community_post_likes_time_post_idx on public.community_post_likes (created_at desc, post_id, user_id);
do $$
declare
  function_signature text;
  definition text;
  order_old text := $old$        case when p_sort = 'latest' then null else post.like_count end desc nulls last,
        case when p_sort = 'latest' then null else post.comment_count end desc nulls last,
        post.created_at desc,$old$;
  order_new text := $new$        case when p_sort = 'trending' and activity.recent_likes >= 3 and activity.recent_people >= 2 then 1 else 0 end desc,
        case when p_sort = 'popular' then activity.popular_likes end desc nulls last,
        case when p_sort = 'trending' then activity.recent_likes - activity.previous_likes end desc nulls last,
        case when p_sort = 'trending' then activity.recent_likes end desc nulls last,
        case when p_sort in ('popular', 'trending') then activity.recent_people end desc nulls last,
        post.created_at desc,$new$;
  from_old text := $old$    from public.community_posts as post
    where post.deleted_at is null$old$;
  from_new text := $new$    from public.community_posts as post
    left join public.community_post_ranking_cache as activity on activity.post_id = post.id
    where post.deleted_at is null$from_new$;
begin
  foreach function_signature in array array[
    'public.moonble_list_community_posts(text,text,text,integer,integer)',
    'public.moonble_list_community_posts_by_category(text,text,text,integer,integer,text)'
  ] loop
    definition := pg_catalog.pg_get_functiondef(function_signature::regprocedure);
    if position(order_old in definition) = 0 or position(from_old in definition) = 0 then
      raise exception 'Could not update community ranking RPC: %', function_signature;
    end if;
    definition := regexp_replace(definition, E'\n[[:space:]]*STABLE[[:space:]]*\n', E'\n VOLATILE\n', 'i');
    if function_signature = 'public.moonble_list_community_posts(text,text,text,integer,integer)' then
      definition := replace(definition, $start$begin
  if p_scope$start$, $refresh$begin
  if coalesce(p_sort, 'popular') <> 'latest' then
    perform public.moonble_refresh_public_quiz_rankings();
  end if;
  if p_scope$refresh$);
    else
      definition := replace(definition, $start$begin
  if p_category$start$, $refresh$begin
  if coalesce(p_sort, 'popular') <> 'latest' then
    perform public.moonble_refresh_public_quiz_rankings();
  end if;
  if p_category$refresh$);
    end if;
    definition := replace(definition, order_old, order_new);
    definition := replace(definition, from_old, from_new);
    if position('moonble_refresh_public_quiz_rankings' in definition) = 0 then
      raise exception 'Could not add ranking cache refresh to community RPC: %', function_signature;
    end if;
    execute definition;
  end loop;
end;
$$;
revoke all on function public.moonble_list_community_posts(text,text,text,integer,integer) from public;
revoke all on function public.moonble_list_community_posts_by_category(text,text,text,integer,integer,text) from public;
grant execute on function public.moonble_list_community_posts(text,text,text,integer,integer) to anon, authenticated;
grant execute on function public.moonble_list_community_posts_by_category(text,text,text,integer,integer,text) to anon, authenticated;

commit;
