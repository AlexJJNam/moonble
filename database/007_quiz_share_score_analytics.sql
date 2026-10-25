-- Supabase SQL Editor에서 database/006_quiz_share_rankings.sql 적용 후 실행합니다.
-- 공유 문제 순위 응답에 참여자 최고 점수의 평균, 표준편차, 분포를 추가합니다.
begin;

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
  average_score numeric;
  standard_deviation numeric;
  score_distribution jsonb;
  top_three jsonb;
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
    (1 + count(*) filter (where participant.best_score > participant_score))::integer,
    round(avg(participant.best_score)::numeric, 1),
    coalesce(round(stddev_pop(participant.best_score)::numeric, 1), 0)
    into participant_total, participant_rank, average_score, standard_deviation
  from public.quiz_share_participants as participant
  where participant.share_id = share_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('score', bucket.bucket * 10, 'count', coalesce(score_counts.participant_count, 0))
      order by bucket.bucket
    ),
    '[]'::jsonb
  ) into score_distribution
  from generate_series(0, 10) as bucket(bucket)
  left join (
    select least(participant.best_score / 10, 10) as bucket, count(*)::integer as participant_count
    from public.quiz_share_participants as participant
    where participant.share_id = share_row.id
    group by least(participant.best_score / 10, 10)
  ) as score_counts on score_counts.bucket = bucket.bucket;

  select coalesce(
    jsonb_agg(jsonb_build_object('rank', ranked.rank, 'score', ranked.best_score) order by ranked.rank, ranked.position),
    '[]'::jsonb
  ) into top_three
  from (
    select ranked_scores.rank, ranked_scores.best_score, ranked_scores.position
    from (
      select participant.best_score,
        rank() over (order by participant.best_score desc)::integer as rank,
        row_number() over (order by participant.best_score desc, participant.created_at asc, participant.participant_id asc) as position
      from public.quiz_share_participants as participant
      where participant.share_id = share_row.id
    ) as ranked_scores
    where ranked_scores.rank <= 3
    order by ranked_scores.rank, ranked_scores.position
    limit 3
  ) as ranked;

  return jsonb_build_object(
    'rank', participant_rank,
    'participants', participant_total,
    'best_score', participant_score,
    'average_score', average_score,
    'standard_deviation', standard_deviation,
    'score_distribution', score_distribution,
    'top_three', top_three
  );
end;
$$;

revoke all on function public.moonble_get_quiz_share_rank(text, uuid, uuid) from public;
grant execute on function public.moonble_get_quiz_share_rank(text, uuid, uuid) to anon, authenticated;

commit;
