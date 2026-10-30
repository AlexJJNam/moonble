-- 시간표 날짜: 그날 한 번만 있는 일정과, 시작 날짜부터 고른 요일마다 반복하는 일정.
-- 1) repeat_weekly(매주 반복 여부)·start_date(그날 또는 반복 시작 날짜) 열을 더한다. 기존 일정은 '매주 반복, 시작 날짜 없음'으로 그대로 보인다.
-- 2) 저장 전 검사: 한 번 일정은 요일을 그 날짜 요일로 맞추고, 한 사람당 일정은 500개까지.
-- 3) 푸시 알림 대기열 함수가 날짜를 지키게 바꾼다(1분마다 실행하는 예약 025는 푸시 배포 때).
-- 기존 데이터는 바꾸지 않는다. 다시 실행해도 안전하다.

alter table public.study_schedules add column if not exists repeat_weekly boolean not null default true;
alter table public.study_schedules add column if not exists start_date date;
alter table public.study_schedules drop constraint if exists study_schedules_once_has_date;
alter table public.study_schedules add constraint study_schedules_once_has_date check (repeat_weekly or start_date is not null);

create or replace function public.moonble_study_schedule_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  if not new.repeat_weekly and new.start_date is not null then
    new.days := array[extract(dow from new.start_date)::smallint];
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.study_schedules where user_id = new.user_id) >= 500 then
    raise exception 'Too many schedules' using errcode = '54000';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and (new.days is distinct from old.days or new.start_time is distinct from old.start_time or new.notify_before is distinct from old.notify_before or new.timezone is distinct from old.timezone
    or new.start_date is distinct from old.start_date or new.repeat_weekly is distinct from old.repeat_weekly) then
    new.last_reminded_at := null;
  end if;
  return new;
end;
$$;

-- 1분마다: 각 일정의 시간대 기준으로 '시작 시각 - 미리 알림'이 막 지난(3분 이내) 일정을 알림으로 넣는다.
-- 한 번 일정은 그 날짜에만, 매주 일정은 시작 날짜 이후 고른 요일에만.
create or replace function public.moonble_enqueue_study_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer := 0;
begin
  with candidates as (
    select s.id, s.user_id, s.title, s.memo, s.days, s.start_time, s.end_time, s.notify_before, s.paper_kind, s.paper_ref, s.paper_title,
      s.repeat_weekly, s.start_date,
      (now() at time zone s.timezone) as local_now,
      ((now() at time zone s.timezone)::date + offsets.day_offset) as event_date
    from public.study_schedules as s
    cross join (values (0), (1)) as offsets(day_offset)
    where s.notify
      and (s.last_reminded_at is null or s.last_reminded_at < now() - interval '30 minutes')
  ), due as (
    select distinct on (c.id) c.*
    from candidates as c
    where extract(dow from c.event_date)::smallint = any(c.days)
      and (c.repeat_weekly or c.event_date = c.start_date)
      and (c.start_date is null or c.event_date >= c.start_date)
      and (c.event_date + c.start_time) - make_interval(mins => c.notify_before) <= c.local_now
      and (c.event_date + c.start_time) - make_interval(mins => c.notify_before) > c.local_now - interval '3 minutes'
    order by c.id, c.event_date
  ), marked as (
    update public.study_schedules as s
    set last_reminded_at = now()
    from due
    where s.id = due.id
    returning due.*
  )
  insert into public.study_reminder_notifications (user_id, schedule_id, title, body, url)
  select m.user_id, m.id,
    left('문블 · ' || m.title, 80),
    left(to_char(m.start_time, 'HH24:MI') || ' ~ ' || to_char(m.end_time, 'HH24:MI')
      || case when m.notify_before > 0 then ' · ' || m.notify_before || '분 후 시작' else ' · 지금 시작' end
      || case when m.paper_title is not null then ' · ' || m.paper_title else '' end
      || case when m.memo <> '' then ' · ' || split_part(m.memo, E'\n', 1) else '' end, 180),
    case m.paper_kind
      when 'custom' then 'https://moonble.com/solve.html?paper=custom&bank=' || m.paper_ref || '#quiz'
      when 'builtin' then 'https://moonble.com/solve.html?paper=' || m.paper_ref || '#quiz'
      when 'share' then 'https://moonble.com/solve.html#share=' || m.paper_ref
      else 'https://moonble.com/prd.html#/schedule'
    end
  from marked as m;
  get diagnostics inserted = row_count;
  delete from public.study_reminder_notifications where created_at < now() - interval '7 days';
  return inserted;
end;
$$;
revoke all on function public.moonble_enqueue_study_reminders() from public, anon, authenticated;
revoke all on function public.moonble_study_schedule_guard() from public, anon, authenticated;
