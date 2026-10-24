-- Supabase SQL Editor에서 적용합니다.
-- 문제지/그룹 저장, 로컬 데이터 이전, 비로그인 공유 링크의 첫 DB 단계입니다.
begin;

create table if not exists public.quiz_groups (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists quiz_groups_owner_order_idx
  on public.quiz_groups (owner_id, sort_order) where deleted_at is null;

create table if not exists public.quiz_banks (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id text references public.quiz_groups(id) on delete set null,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '',
  source text not null default '커스텀 문제',
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  sort_order integer not null default 0,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists quiz_banks_owner_order_idx
  on public.quiz_banks (owner_id, sort_order) where deleted_at is null;
create index if not exists quiz_banks_owner_group_idx
  on public.quiz_banks (owner_id, group_id) where deleted_at is null;

create table if not exists public.quiz_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bank_id text not null references public.quiz_banks(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- 기기별 로컬 토큰이 없어도 새 링크를 발급할 수 있게 한 문제지에 여러 활성 링크를 허용합니다.
-- 소유자가 공유 중지하면 해당 문제지의 모든 링크를 함께 무효화합니다.
alter table public.quiz_shares drop constraint if exists quiz_shares_owner_id_bank_id_key;
create index if not exists quiz_shares_active_token_idx
  on public.quiz_shares (token_hash) where revoked_at is null;

alter table public.quiz_groups enable row level security;
alter table public.quiz_banks enable row level security;
alter table public.quiz_shares enable row level security;

revoke all on public.quiz_groups, public.quiz_banks, public.quiz_shares from public, anon, authenticated;
grant select on public.quiz_groups, public.quiz_banks to authenticated;

drop policy if exists quiz_groups_select_own on public.quiz_groups;
create policy quiz_groups_select_own on public.quiz_groups
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists quiz_banks_select_own on public.quiz_banks;
create policy quiz_banks_select_own on public.quiz_banks
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.moonble_save_custom_bank_collection(
  p_groups jsonb,
  p_banks jsonb,
  p_deleted_group_ids text[] default '{}',
  p_deleted_bank_ids text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  item jsonb;
  question_item jsonb;
  item_id text;
  item_group_id text;
  item_updated_at timestamptz;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_typeof(p_banks) is distinct from 'array' then
    raise exception 'Invalid problem collection' using errcode = '22023';
  end if;
  if jsonb_array_length(p_groups) > 200 or jsonb_array_length(p_banks) > 500
    or octet_length(p_groups::text) + octet_length(p_banks::text) > 12000000 then
    raise exception 'Invalid problem collection' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_groups) loop
    item_id := item ->> 'id';
    if jsonb_typeof(item) is distinct from 'object'
      or item_id is null or char_length(item_id) not between 1 and 120
      or jsonb_typeof(item -> 'name') is distinct from 'string'
      or char_length(btrim(item ->> 'name')) not between 1 and 24 then
      raise exception 'Invalid group' using errcode = '22023';
    end if;
    item_updated_at := coalesce(nullif(item ->> 'updated_at', '')::timestamptz, nullif(item ->> 'updatedAt', '')::timestamptz, now());
    insert into public.quiz_groups (id, owner_id, name, sort_order, created_at, updated_at, deleted_at)
    values (
      item_id, requesting_user_id, btrim(item ->> 'name'), coalesce((item ->> 'sort_order')::integer, 0),
      coalesce(nullif(item ->> 'created_at', '')::timestamptz, nullif(item ->> 'createdAt', '')::timestamptz, now()),
      item_updated_at, null
    )
    on conflict (id) do update set
      name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
    where quiz_groups.owner_id = requesting_user_id
      and quiz_groups.deleted_at is null
      and excluded.updated_at >= quiz_groups.updated_at;
  end loop;

  for item in select value from jsonb_array_elements(p_banks) loop
    item_id := item ->> 'id';
    item_group_id := nullif(item ->> 'group_id', '');
    if item_group_id = 'ungrouped' then item_group_id := null; end if;
    if jsonb_typeof(item) is distinct from 'object'
      or item_id is null or char_length(item_id) not between 1 and 120
      or jsonb_typeof(item -> 'title') is distinct from 'string'
      or char_length(btrim(item ->> 'title')) not between 1 and 100
      or jsonb_typeof(item -> 'questions') is distinct from 'array'
      or octet_length(coalesce((item -> 'questions')::text, '')) > 2000000 then
      raise exception 'Invalid problem bank' using errcode = '22023';
    end if;
    if jsonb_array_length(item -> 'questions') not between 20 and 1000 then
      raise exception 'Invalid problem bank' using errcode = '22023';
    end if;
    if item_group_id is not null and not exists (
      select 1 from public.quiz_groups as group_row
      where group_row.id = item_group_id and group_row.owner_id = requesting_user_id and group_row.deleted_at is null
    ) then
      item_group_id := null;
    end if;
    for question_item in select value from jsonb_array_elements(item -> 'questions') loop
      if jsonb_typeof(question_item -> 'id') is distinct from 'number'
        or jsonb_typeof(question_item -> 'q') is distinct from 'string'
        or jsonb_typeof(question_item -> 'options') is distinct from 'array'
        or jsonb_typeof(question_item -> 'correct') is distinct from 'array' then
        raise exception 'Invalid question in problem bank' using errcode = '22023';
      end if;
      if jsonb_array_length(question_item -> 'options') not between 2 and 12
        or jsonb_array_length(question_item -> 'correct') < 1 then
        raise exception 'Invalid question in problem bank' using errcode = '22023';
      end if;
    end loop;
    item_updated_at := coalesce(nullif(item ->> 'updated_at', '')::timestamptz, nullif(item ->> 'updatedAt', '')::timestamptz, now());
    insert into public.quiz_banks (id, owner_id, group_id, title, description, source, questions, sort_order, saved_at, updated_at, deleted_at)
    values (
      item_id, requesting_user_id, item_group_id, btrim(item ->> 'title'), coalesce(item ->> 'description', ''),
      coalesce(item ->> 'source', '커스텀 문제'), item -> 'questions', coalesce((item ->> 'sort_order')::integer, 0),
      coalesce(nullif(item ->> 'saved_at', '')::timestamptz, nullif(item ->> 'savedAt', '')::timestamptz, now()), item_updated_at, null
    )
    on conflict (id) do update set
      group_id = excluded.group_id,
      title = excluded.title,
      description = excluded.description,
      source = excluded.source,
      questions = excluded.questions,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
    where quiz_banks.owner_id = requesting_user_id
      and quiz_banks.deleted_at is null
      and excluded.updated_at >= quiz_banks.updated_at;
  end loop;

  if coalesce(cardinality(p_deleted_bank_ids), 0) > 0 then
    update public.quiz_banks
    set deleted_at = now(), updated_at = now()
    where owner_id = requesting_user_id and id = any(p_deleted_bank_ids) and deleted_at is null;
    update public.quiz_shares
    set revoked_at = coalesce(revoked_at, now())
    where owner_id = requesting_user_id and bank_id = any(p_deleted_bank_ids);
  end if;

  if coalesce(cardinality(p_deleted_group_ids), 0) > 0 then
    update public.quiz_banks
    set group_id = null, updated_at = now()
    where owner_id = requesting_user_id and group_id = any(p_deleted_group_ids) and deleted_at is null;
    update public.quiz_groups
    set deleted_at = now(), updated_at = now()
    where owner_id = requesting_user_id and id = any(p_deleted_group_ids) and deleted_at is null;
  end if;
end;
$$;

create or replace function public.moonble_create_quiz_share(p_bank_id text, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  bank_row public.quiz_banks%rowtype;
  snapshot_row jsonb;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid share token' using errcode = '22023';
  end if;
  select * into bank_row from public.quiz_banks
  where id = p_bank_id and owner_id = requesting_user_id and deleted_at is null;
  if not found then raise exception 'Problem bank not found' using errcode = 'P0002'; end if;

  snapshot_row := jsonb_build_object('title', bank_row.title, 'description', bank_row.description, 'questions', bank_row.questions);
  insert into public.quiz_shares (owner_id, bank_id, token_hash, snapshot, created_at, revoked_at)
  values (requesting_user_id, bank_row.id, p_token_hash, snapshot_row, now(), null);
end;
$$;

create or replace function public.moonble_get_quiz_share(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select share.snapshot
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and share.token_hash = p_token_hash
    and share.revoked_at is null
    and bank.deleted_at is null
  limit 1;
$$;

create or replace function public.moonble_revoke_quiz_share(p_bank_id text)
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
  update public.quiz_shares
  set revoked_at = coalesce(revoked_at, now())
  where owner_id = requesting_user_id and bank_id = p_bank_id;
end;
$$;

revoke all on function public.moonble_save_custom_bank_collection(jsonb, jsonb, text[], text[]) from public, anon;
revoke all on function public.moonble_create_quiz_share(text, text) from public, anon;
revoke all on function public.moonble_get_quiz_share(text) from public;
revoke all on function public.moonble_revoke_quiz_share(text) from public, anon;
grant execute on function public.moonble_save_custom_bank_collection(jsonb, jsonb, text[], text[]) to authenticated;
grant execute on function public.moonble_create_quiz_share(text, text) to authenticated;
grant execute on function public.moonble_get_quiz_share(text) to anon, authenticated;
grant execute on function public.moonble_revoke_quiz_share(text) to authenticated;

commit;
