-- Supabase SQL Editor에서 나의 성취도 기록을 계정별로 저장하기 위해 실행합니다.
begin;

create table if not exists public.quiz_attempt_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null,
  paper_id text not null check (char_length(paper_id) between 1 and 80),
  bank_id text,
  group_id text,
  paper_title text not null default '문제지' check (char_length(paper_title) <= 160),
  paper_description text not null default '' check (char_length(paper_description) <= 2000),
  score smallint not null check (score between 0 and 100),
  correct_count smallint not null check (correct_count between 0 and 500),
  total_count smallint not null check (total_count between 1 and 500),
  question_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(question_ids) = 'array'),
  wrong_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(wrong_ids) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempt_history_user_date_idx
  on public.quiz_attempt_history (user_id, attempted_at desc);
create index if not exists quiz_attempt_history_user_bank_idx
  on public.quiz_attempt_history (user_id, bank_id, attempted_at desc);

alter table public.quiz_attempt_history enable row level security;
revoke all on public.quiz_attempt_history from public, anon, authenticated;
grant select, insert, delete on public.quiz_attempt_history to authenticated;

drop policy if exists quiz_attempt_history_select_own on public.quiz_attempt_history;
create policy quiz_attempt_history_select_own on public.quiz_attempt_history
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists quiz_attempt_history_insert_own on public.quiz_attempt_history;
create policy quiz_attempt_history_insert_own on public.quiz_attempt_history
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists quiz_attempt_history_delete_own on public.quiz_attempt_history;
create policy quiz_attempt_history_delete_own on public.quiz_attempt_history
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
