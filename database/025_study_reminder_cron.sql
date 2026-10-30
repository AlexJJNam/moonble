-- 시간표 푸시 알림 켜기(푸시 배포 때 실행): 1분마다 알림 시각이 된 일정을 study_reminder_notifications에 넣는다.
-- 024_study_schedules.sql 이후, VAPID 키·quiz-share-push 함수 배포·study_reminder_notifications 웹훅을 마친 뒤 실행한다.
-- 다시 실행해도 같은 예약 하나만 남는다.

-- pg_cron을 켤 수 없으면 안내만 남긴다(Supabase → Database → Extensions에서 pg_cron을 켠 뒤 다시 실행).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'moonble-study-reminders';
  perform cron.schedule('moonble-study-reminders', '* * * * *', 'select public.moonble_enqueue_study_reminders()');
exception when others then
  raise notice 'pg_cron 예약을 건너뛰었어요: %. Database → Extensions에서 pg_cron을 켠 뒤 다시 실행해주세요.', sqlerrm;
end;
$$;
