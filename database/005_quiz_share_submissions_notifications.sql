-- Supabase SQL Editor에서 003_quiz_banks_and_shares.sql 적용 후 실행합니다.
-- 비로그인 공유 문제 풀이 제출을 검증하고 문제지 소유자에게 인앱 알림을 전달합니다.
begin;

create table if not exists public.quiz_share_notifications (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.quiz_shares(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  paper_title text not null,
  score integer not null check (score between 0 and 100),
  correct_count integer not null check (correct_count between 0 and 1000),
  total_count integer not null check (total_count between 1 and 1000),
  submission_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint quiz_share_notifications_correct_range check (correct_count <= total_count),
  constraint quiz_share_notifications_submission_unique unique (share_id, submission_id)
);

create index if not exists quiz_share_notifications_owner_unread_idx
  on public.quiz_share_notifications (owner_id, created_at)
  where read_at is null;

alter table public.quiz_share_notifications enable row level security;
revoke all on public.quiz_share_notifications from public, anon, authenticated;

create or replace function public.moonble_submit_shared_quiz(
  p_token_hash text,
  p_submission_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_row public.quiz_shares%rowtype;
  notification_row public.quiz_share_notifications%rowtype;
  answer_item jsonb;
  question_row jsonb;
  answer_count integer;
  correct_total integer := 0;
  answer_question_id text;
  expected_indices integer[];
  selected_indices integer[];
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_submission_id is null
    or jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Invalid shared quiz submission' using errcode = '22023';
  end if;

  select share.* into share_row
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.token_hash = p_token_hash
    and share.revoked_at is null
    and bank.deleted_at is null
  limit 1;
  if not found then raise exception 'Shared quiz is unavailable' using errcode = 'P0002'; end if;

  answer_count := jsonb_array_length(p_answers);
  if answer_count < 1
    or answer_count <> least(20, jsonb_array_length(share_row.snapshot -> 'questions'))
    or octet_length(p_answers::text) > 64000 then
    raise exception 'Invalid shared quiz answers' using errcode = '22023';
  end if;

  if (select count(distinct value ->> 'question_id') from jsonb_array_elements(p_answers)) <> answer_count then
    raise exception 'Duplicate shared quiz answer' using errcode = '22023';
  end if;

  for answer_item in select value from jsonb_array_elements(p_answers) loop
    if jsonb_typeof(answer_item) is distinct from 'object'
      or jsonb_typeof(answer_item -> 'question_id') is distinct from 'number'
      or jsonb_typeof(answer_item -> 'selected') is distinct from 'array' then
      raise exception 'Invalid shared quiz answer' using errcode = '22023';
    end if;

    answer_question_id := answer_item ->> 'question_id';
    select question.value into question_row
    from jsonb_array_elements(share_row.snapshot -> 'questions') as question(value)
    where question.value ->> 'id' = answer_question_id
    limit 1;
    if question_row is null
      or jsonb_typeof(question_row -> 'options') is distinct from 'array'
      or jsonb_typeof(question_row -> 'correct') is distinct from 'array' then
      raise exception 'Question is not part of this shared quiz' using errcode = '22023';
    end if;

    select coalesce(array_agg(value::integer order by value::integer), array[]::integer[])
      into expected_indices
    from jsonb_array_elements_text(question_row -> 'correct') as correct(value);

    if exists (
      select 1 from jsonb_array_elements(answer_item -> 'selected') as selected(value)
      where jsonb_typeof(value) is distinct from 'number'
        or value::text !~ '^(0|[1-9][0-9]*)$'
    ) then
      raise exception 'Invalid selected answer' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(answer_item -> 'selected') as selected(value)
      where value::numeric >= jsonb_array_length(question_row -> 'options')
    ) then
      raise exception 'Invalid selected answer' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct value::integer order by value::integer), array[]::integer[])
      into selected_indices
    from jsonb_array_elements_text(answer_item -> 'selected') as selected(value);

    if cardinality(selected_indices) <> jsonb_array_length(answer_item -> 'selected') then
      raise exception 'Duplicate selected answer' using errcode = '22023';
    end if;
    if selected_indices = expected_indices then correct_total := correct_total + 1; end if;
  end loop;

  insert into public.quiz_share_notifications (
    share_id, owner_id, paper_title, score, correct_count, total_count, submission_id
  ) values (
    share_row.id,
    share_row.owner_id,
    left(coalesce(share_row.snapshot ->> 'title', '공유 문제지'), 100),
    round((correct_total::numeric / answer_count) * 100)::integer,
    correct_total,
    answer_count,
    p_submission_id
  )
  on conflict (share_id, submission_id) do nothing;

  select * into notification_row
  from public.quiz_share_notifications as notification
  where notification.share_id = share_row.id
    and notification.submission_id = p_submission_id;

  return jsonb_build_object(
    'saved', true,
    'score', notification_row.score,
    'correct', notification_row.correct_count,
    'total', notification_row.total_count
  );
end;
$$;

create or replace function public.moonble_take_next_quiz_share_notification()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  notification_row public.quiz_share_notifications%rowtype;
begin
  if requesting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into notification_row
  from public.quiz_share_notifications as notification
  where notification.owner_id = requesting_user_id
    and notification.read_at is null
  order by notification.created_at asc
  limit 1
  for update skip locked;

  if not found then return null; end if;
  update public.quiz_share_notifications
  set read_at = now()
  where id = notification_row.id and owner_id = requesting_user_id;

  return jsonb_build_object(
    'id', notification_row.id,
    'title', notification_row.paper_title,
    'score', notification_row.score,
    'correct', notification_row.correct_count,
    'total', notification_row.total_count,
    'created_at', notification_row.created_at
  );
end;
$$;

revoke all on function public.moonble_submit_shared_quiz(text, uuid, jsonb) from public;
revoke all on function public.moonble_take_next_quiz_share_notification() from public, anon;
grant execute on function public.moonble_submit_shared_quiz(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.moonble_take_next_quiz_share_notification() to authenticated;

commit;
