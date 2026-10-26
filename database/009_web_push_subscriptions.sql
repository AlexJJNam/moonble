-- Supabase SQL Editor에서 008_profile_avatars.sql 적용 후 새 쿼리로 실행합니다.
-- 브라우저 푸시 구독 주소는 소유자만 등록/해제하고 서버 함수만 조회할 수 있습니다.
begin;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://[^[:space:]]+$' and octet_length(endpoint) <= 2048),
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_id_idx
  on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;
revoke all on public.web_push_subscriptions from public, anon, authenticated;
grant select, delete on public.web_push_subscriptions to service_role;

create or replace function public.moonble_save_web_push_subscription(p_subscription jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  endpoint_value text;
  p256dh_value text;
  auth_value text;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_subscription) is distinct from 'object'
    or octet_length(p_subscription::text) > 8192 then
    raise exception 'Invalid push subscription' using errcode = '22023';
  end if;

  endpoint_value := p_subscription ->> 'endpoint';
  p256dh_value := p_subscription #>> '{keys,p256dh}';
  auth_value := p_subscription #>> '{keys,auth}';
  if endpoint_value is null or endpoint_value !~ '^https://[^[:space:]]+$'
    or octet_length(endpoint_value) > 2048
    or p256dh_value is null or octet_length(p256dh_value) not between 20 and 256
    or auth_value is null or octet_length(auth_value) not between 8 and 128 then
    raise exception 'Invalid push subscription keys' using errcode = '22023';
  end if;

  insert into public.web_push_subscriptions (user_id, endpoint, subscription, updated_at)
  values (requesting_user_id, endpoint_value, p_subscription, now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        updated_at = now();
end;
$$;

create or replace function public.moonble_delete_web_push_subscription(p_endpoint text)
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
  if p_endpoint is null or octet_length(p_endpoint) > 2048 then
    raise exception 'Invalid push endpoint' using errcode = '22023';
  end if;

  delete from public.web_push_subscriptions
  where user_id = requesting_user_id and endpoint = p_endpoint;
end;
$$;

revoke all on function public.moonble_save_web_push_subscription(jsonb) from public, anon;
revoke all on function public.moonble_delete_web_push_subscription(text) from public, anon;
grant execute on function public.moonble_save_web_push_subscription(jsonb) to authenticated;
grant execute on function public.moonble_delete_web_push_subscription(text) to authenticated;

commit;
