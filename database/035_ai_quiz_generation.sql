-- 내부 AI 생성 사용량: 문제지 내용과 사용자 프롬프트는 저장하지 않습니다.
-- Supabase SQL Editor에서 한 번 실행합니다.
begin;
create table if not exists public.ai_quiz_generation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  usage_day date not null,
  status text not null check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  primary key (user_id, request_id)
);
create index if not exists ai_quiz_generation_day_idx on public.ai_quiz_generation_requests (usage_day, status, user_id);
create index if not exists ai_quiz_generation_pending_expiry_idx on public.ai_quiz_generation_requests (expires_at) where status = 'pending';
alter table public.ai_quiz_generation_requests enable row level security;
revoke all on public.ai_quiz_generation_requests from public, anon, authenticated;

-- 서비스 역할만 호출합니다. 예약·일일 한도 확인을 한 트랜잭션에서 직렬화합니다.
create or replace function public.moonble_reserve_ai_quiz_generation(p_user_id uuid, p_request_id uuid, p_global_limit integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  day_kst date := (now() at time zone 'Asia/Seoul')::date;
  existing public.ai_quiz_generation_requests%rowtype;
  user_count integer;
  global_count integer;
begin
  if p_user_id is null or p_request_id is null or (p_global_limit is not null and (p_global_limit < 1 or p_global_limit > 1000000)) then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('moonble-ai-quiz-quota', 0));
  update public.ai_quiz_generation_requests set status = 'failed', completed_at = now()
    where status = 'pending' and expires_at <= now();
  select * into existing from public.ai_quiz_generation_requests where user_id = p_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('status', case when existing.status = 'pending' then 'in_progress' when existing.status = 'success' then 'already_done' else 'failed' end);
  end if;
  select count(*) into user_count from public.ai_quiz_generation_requests
    where user_id = p_user_id and ((usage_day = day_kst and status = 'success') or (status = 'pending' and expires_at > now()));
  if user_count >= 5 then return jsonb_build_object('status', 'user_limit', 'remaining', 0); end if;
  if p_global_limit is not null then
    select count(*) into global_count from public.ai_quiz_generation_requests where (usage_day = day_kst and status = 'success') or (status = 'pending' and expires_at > now());
    if global_count >= p_global_limit then return jsonb_build_object('status', 'global_limit', 'remaining', 5 - user_count); end if;
  end if;
  insert into public.ai_quiz_generation_requests (user_id, request_id, usage_day, status, expires_at)
    values (p_user_id, p_request_id, day_kst, 'pending', now() + interval '3 minutes');
  return jsonb_build_object('status', 'reserved', 'remaining', 4 - user_count);
end;
$$;
revoke all on function public.moonble_reserve_ai_quiz_generation(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.moonble_reserve_ai_quiz_generation(uuid, uuid, integer) to service_role;

create or replace function public.moonble_finish_ai_quiz_generation(p_user_id uuid, p_request_id uuid, p_success boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  if p_user_id is null or p_request_id is null or p_success is null then raise exception 'Invalid request' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('moonble-ai-quiz-quota', 0));
  select status into current_status from public.ai_quiz_generation_requests where user_id = p_user_id and request_id = p_request_id for update;
  if current_status = 'success' then return p_success; end if;
  if current_status is distinct from 'pending' then return false; end if;
  update public.ai_quiz_generation_requests
    set status = case when p_success and expires_at > now() then 'success' else 'failed' end,
        usage_day = case when p_success and expires_at > now() then (now() at time zone 'Asia/Seoul')::date else usage_day end,
        completed_at = now()
    where user_id = p_user_id and request_id = p_request_id
    returning status into current_status;
  return current_status = case when p_success then 'success' else 'failed' end;
end;
$$;
revoke all on function public.moonble_finish_ai_quiz_generation(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.moonble_finish_ai_quiz_generation(uuid, uuid, boolean) to service_role;

create or replace function public.moonble_ai_quiz_remaining()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare used integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select count(*) into used from public.ai_quiz_generation_requests
    where user_id = auth.uid() and ((usage_day = (now() at time zone 'Asia/Seoul')::date and status = 'success')
      or (status = 'pending' and expires_at > now()));
  return jsonb_build_object('remaining', greatest(0, 5 - used), 'limit', 5);
end;
$$;
revoke all on function public.moonble_ai_quiz_remaining() from public, anon, authenticated;
grant execute on function public.moonble_ai_quiz_remaining() to authenticated;
commit;
