-- Apply after 005_quiz_share_submissions_notifications.sql in the Supabase SQL Editor.
-- Anonymous participant IDs are scoped to a shared quiz and stored only in this database table.
begin;

create table if not exists public.quiz_share_participants (
  share_id uuid not null references public.quiz_shares(id) on delete cascade,
  participant_id uuid not null,
  best_score integer not null check (best_score between 0 and 100),
  correct_count integer not null check (correct_count between 0 and 1000),
  total_count integer not null check (total_count between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_share_participants_correct_range check (correct_count <= total_count),
  primary key (share_id, participant_id)
);

create index if not exists quiz_share_participants_ranking_idx
  on public.quiz_share_participants (share_id, best_score desc, created_at asc);

alter table public.quiz_share_participants enable row level security;
revoke all on public.quiz_share_participants from public, anon, authenticated;

-- Preserve existing submissions as historical participants; the previous schema did not store a participant identifier.
insert into public.quiz_share_participants (
  share_id, participant_id, best_score, correct_count, total_count, created_at, updated_at
)
select notification.share_id, notification.submission_id, notification.score,
  notification.correct_count, notification.total_count, notification.created_at, notification.created_at
from public.quiz_share_notifications as notification
on conflict (share_id, participant_id) do nothing;

create or replace function public.moonble_get_quiz_share_rank(
  p_token_hash text,
  p_submission_id uuid,
  p_participant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_row public.quiz_shares%rowtype;
  submission_row public.quiz_share_notifications%rowtype;
  participant_score integer;
  participant_rank integer;
  participant_total integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_submission_id is null
    or p_participant_id is null then
    raise exception 'Invalid quiz share rank request' using errcode = '22023';
  end if;

  select share.* into share_row
  from public.quiz_shares as share
  join public.quiz_banks as bank on bank.id = share.bank_id and bank.owner_id = share.owner_id
  where share.token_hash = p_token_hash
    and share.revoked_at is null
    and bank.deleted_at is null
  limit 1;
  if not found then raise exception 'Shared quiz is unavailable' using errcode = 'P0002'; end if;

  select notification.* into submission_row
  from public.quiz_share_notifications as notification
  where notification.share_id = share_row.id
    and notification.owner_id = share_row.owner_id
    and notification.submission_id = p_submission_id
  limit 1;
  if not found then raise exception 'Shared quiz submission is unavailable' using errcode = 'P0002'; end if;

  insert into public.quiz_share_participants as current_participant (
    share_id, participant_id, best_score, correct_count, total_count, created_at, updated_at
  ) values (
    share_row.id, p_participant_id, submission_row.score, submission_row.correct_count,
    submission_row.total_count, submission_row.created_at, submission_row.created_at
  )
  on conflict (share_id, participant_id) do update set
    best_score = greatest(current_participant.best_score, excluded.best_score),
    correct_count = case
      when excluded.best_score > current_participant.best_score then excluded.correct_count
      else current_participant.correct_count
    end,
    total_count = excluded.total_count,
    updated_at = greatest(current_participant.updated_at, excluded.updated_at);

  select participant.best_score into participant_score
  from public.quiz_share_participants as participant
  where participant.share_id = share_row.id
    and participant.participant_id = p_participant_id;

  select count(*)::integer,
    (1 + count(*) filter (where participant.best_score > participant_score))::integer
    into participant_total, participant_rank
  from public.quiz_share_participants as participant
  where participant.share_id = share_row.id;

  return jsonb_build_object(
    'rank', participant_rank,
    'participants', participant_total,
    'best_score', participant_score
  );
end;
$$;

revoke all on function public.moonble_get_quiz_share_rank(text, uuid, uuid) from public;
grant execute on function public.moonble_get_quiz_share_rank(text, uuid, uuid) to anon, authenticated;

commit;
