-- 워크스페이스 일지·회고: 일간 일지 · 주간 회고 · 월간 회고와 문제지 풀이 기록 첨부.
-- 1) journal_entries: 사람·워크스페이스·종류·기간 시작일마다 하나(유니크). 본인만 읽고 쓴다(RLS).
-- 2) journal_attachments: 일지와 내 풀이 기록(quiz_attempt_history)의 연결만 저장한다. 연결을 지우거나 일지를 지워도 풀이 기록은 그대로다.
-- 3) quiz_attempt_history에 재풀이 원본(retry_of)과 틀린 문제에 고른 답(wrong_answers) 칸을 더한다. 예전 기록은 비어 있는 채로 둔다.
-- 기존 데이터는 바꾸지 않는다. 다시 실행해도 안전하다.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace text not null default 'personal' check (workspace = 'personal'),
  kind text not null check (kind in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) <= 20000),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 60000),
  mood smallint check (mood between 1 and 5),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_one_per_period unique (user_id, workspace, kind, period_start),
  constraint journal_entries_period check (
    (kind = 'daily' and period_end = period_start)
    or (kind = 'weekly' and extract(isodow from period_start) = 1 and period_end = period_start + 6)
    or (kind = 'monthly' and extract(day from period_start) = 1 and period_end = (period_start + interval '1 month' - interval '1 day')::date)
  )
);
create index if not exists journal_entries_user_period_idx on public.journal_entries (user_id, kind, period_start desc);
create index if not exists journal_entries_user_tags_idx on public.journal_entries using gin (tags);

-- 저장 전 정리: 기간 끝 날짜 계산, 태그 다듬기(앞뒤 공백·중복·빈 값 제거, 20자), 답변은 글자만, 검색용 글 만들기.
create or replace function public.moonble_journal_entry_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer record;
  cleaned jsonb := '{}'::jsonb;
begin
  if new.kind = 'daily' then new.period_end := new.period_start;
  elsif new.kind = 'weekly' then new.period_end := new.period_start + 6;
  else new.period_end := (new.period_start + interval '1 month' - interval '1 day')::date;
  end if;
  new.tags := coalesce((
    select array_agg(tag order by first_at)
    from (
      select left(btrim(value), 20) as tag, min(ordinality) as first_at
      from unnest(coalesce(new.tags, '{}'::text[])) with ordinality as item(value, ordinality)
      where btrim(value) <> ''
      group by left(btrim(value), 20)
    ) as tidy
  ), '{}'::text[]);
  for answer in select key, value from jsonb_each(coalesce(new.answers, '{}'::jsonb)) loop
    if jsonb_typeof(answer.value) = 'string' and answer.key ~ '^[a-z]{1,20}$' then
      cleaned := cleaned || jsonb_build_object(answer.key, left(answer.value #>> '{}', 5000));
    end if;
  end loop;
  new.answers := cleaned;
  new.search_text := lower(concat_ws(' ', new.title, new.body,
    (select string_agg(value, ' ') from jsonb_each_text(cleaned)),
    array_to_string(new.tags, ' ')));
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end;
$$;
drop trigger if exists journal_entries_guard on public.journal_entries;
create trigger journal_entries_guard before insert or update on public.journal_entries
  for each row execute function public.moonble_journal_entry_guard();

alter table public.journal_entries enable row level security;
drop policy if exists journal_entries_select_own on public.journal_entries;
drop policy if exists journal_entries_insert_own on public.journal_entries;
drop policy if exists journal_entries_update_own on public.journal_entries;
drop policy if exists journal_entries_delete_own on public.journal_entries;
create policy journal_entries_select_own on public.journal_entries for select to authenticated using (user_id = (select auth.uid()));
create policy journal_entries_insert_own on public.journal_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy journal_entries_update_own on public.journal_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy journal_entries_delete_own on public.journal_entries for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.journal_entries from public, anon;
grant select, insert, update, delete on public.journal_entries to authenticated;

-- 풀이 기록: 재풀이 원본과 틀린 문제에 고른 답(이번부터 푸는 기록만 채워진다)
alter table public.quiz_attempt_history add column if not exists retry_of uuid references public.quiz_attempt_history(id) on delete set null;
alter table public.quiz_attempt_history add column if not exists wrong_answers jsonb;
alter table public.quiz_attempt_history drop constraint if exists quiz_attempt_history_wrong_answers_shape;
alter table public.quiz_attempt_history add constraint quiz_attempt_history_wrong_answers_shape
  check (wrong_answers is null or (jsonb_typeof(wrong_answers) = 'object' and pg_column_size(wrong_answers) <= 20000));
create index if not exists quiz_attempt_history_retry_of_idx on public.quiz_attempt_history (retry_of) where retry_of is not null;

-- 일지 ↔ 풀이 기록 연결. 같은 풀이 기록은 한 일지에 한 번만.
create table if not exists public.journal_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempt_history(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint journal_attachments_once unique (entry_id, attempt_id)
);
create index if not exists journal_attachments_user_idx on public.journal_attachments (user_id);
create index if not exists journal_attachments_attempt_idx on public.journal_attachments (attempt_id);

alter table public.journal_attachments enable row level security;
drop policy if exists journal_attachments_select_own on public.journal_attachments;
drop policy if exists journal_attachments_insert_own on public.journal_attachments;
drop policy if exists journal_attachments_delete_own on public.journal_attachments;
create policy journal_attachments_select_own on public.journal_attachments for select to authenticated using (user_id = (select auth.uid()));
-- 내 일지에 내 풀이 기록만 붙일 수 있다(남의 풀이 기록 id를 넣어도 막힌다).
create policy journal_attachments_insert_own on public.journal_attachments for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.journal_entries as e where e.id = entry_id and e.user_id = (select auth.uid()))
  and exists (select 1 from public.quiz_attempt_history as a where a.id = attempt_id and a.user_id = (select auth.uid()))
);
create policy journal_attachments_delete_own on public.journal_attachments for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.journal_attachments from public, anon;
grant select, insert, delete on public.journal_attachments to authenticated;

revoke all on function public.moonble_journal_entry_guard() from public, anon, authenticated;
