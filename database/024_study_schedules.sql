-- 워크스페이스 시간표: 요일별 일정(시간·메모·알림·예약 문제지)과 알림 구조.
-- 1) study_schedules: 내 일정만 읽고 쓸 수 있다(RLS). 지금 실행하면 시간표가 서버에 저장된다.
-- 2) study_reminder_notifications + moonble_enqueue_study_reminders(): 앱을 닫아도 오는 푸시 알림의 구조만 만든다.
--    실제 발송(1분마다 실행하는 pg_cron 예약)은 푸시 배포 때 025_study_reminder_cron.sql로 켠다(docs/WEB_PUSH_SETUP.md 7단계).
-- 기존 데이터는 바꾸지 않는다. 다시 실행해도 안전하다.

create table if not exists public.study_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  memo text not null default '' check (char_length(memo) <= 500),
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  start_time time not null,
  end_time time not null,
  color text not null default 'blue' check (color in ('blue', 'green', 'orange', 'purple', 'pink', 'gray')),
  notify boolean not null default true,
  notify_before smallint not null default 10 check (notify_before in (0, 5, 10, 15, 30, 60)),
  paper_kind text check (paper_kind is null or paper_kind in ('custom', 'builtin', 'share')),
  paper_ref text check (paper_ref is null or paper_ref ~ '^[A-Za-z0-9_-]{1,120}$'),
  paper_title text check (paper_title is null or char_length(paper_title) <= 100),
  timezone text not null default 'Asia/Seoul' check (char_length(timezone) between 1 and 64),
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_schedules_time_order check (end_time > start_time),
  constraint study_schedules_paper_pair check ((paper_kind is null) = (paper_ref is null))
);
create index if not exists study_schedules_user_idx on public.study_schedules (user_id);
create index if not exists study_schedules_notify_idx on public.study_schedules (notify) where notify;

-- 저장 전 검사: 시간대 이름이 올바른지, 한 사람당 일정 100개까지.
create or replace function public.moonble_study_schedule_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  if tg_op = 'INSERT' and (select count(*) from public.study_schedules where user_id = new.user_id) >= 100 then
    raise exception 'Too many schedules' using errcode = '54000';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and (new.days is distinct from old.days or new.start_time is distinct from old.start_time or new.notify_before is distinct from old.notify_before or new.timezone is distinct from old.timezone) then
    new.last_reminded_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists study_schedules_guard on public.study_schedules;
create trigger study_schedules_guard before insert or update on public.study_schedules
  for each row execute function public.moonble_study_schedule_guard();

alter table public.study_schedules enable row level security;
drop policy if exists study_schedules_select_own on public.study_schedules;
drop policy if exists study_schedules_insert_own on public.study_schedules;
drop policy if exists study_schedules_update_own on public.study_schedules;
drop policy if exists study_schedules_delete_own on public.study_schedules;
create policy study_schedules_select_own on public.study_schedules for select to authenticated using (user_id = (select auth.uid()));
create policy study_schedules_insert_own on public.study_schedules for insert to authenticated with check (user_id = (select auth.uid()));
create policy study_schedules_update_own on public.study_schedules for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy study_schedules_delete_own on public.study_schedules for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.study_schedules from public, anon;
grant select, insert, update, delete on public.study_schedules to authenticated;

-- 보낼 알림(앱을 닫아도 오는 푸시용). 브라우저에서는 읽을 수 없다.
create table if not exists public.study_reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid references public.study_schedules(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists study_reminder_notifications_created_idx on public.study_reminder_notifications (created_at);
alter table public.study_reminder_notifications enable row level security;
revoke all on public.study_reminder_notifications from public, anon, authenticated;

-- 1분마다: 각 일정의 시간대 기준으로 '시작 시각 - 미리 알림'이 막 지난(3분 이내) 일정을 알림으로 넣는다.
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
    left(to_char(m.start_time, 'HH24:MI') || '–' || to_char(m.end_time, 'HH24:MI')
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
