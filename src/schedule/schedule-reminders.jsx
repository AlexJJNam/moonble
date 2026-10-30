// 시간표 알림(앱이 열려 있을 때): 20초마다 알림 시각이 된 일정을 찾아
// 화면에는 알림 카드를, 다른 탭에 있으면 시스템 알림을 띄운다. 누르면 예약한 문제지를 연다.
// 앱을 닫아도 오는 푸시는 서버(024 + quiz-share-push)가 같은 tag로 보내 겹치지 않는다.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { listSchedules } from './schedule-api.js';
import { dueReminders, paperUrl } from './schedule-model.js';
import './schedule-reminders.css';

const firedKey = userId => `moonble:user:${userId}:study-reminders-fired`;

function readFired(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(firedKey(userId)) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}
function markFired(userId, key) {
  const now = Date.now();
  const next = Object.fromEntries(Object.entries(readFired(userId)).filter(([, at]) => now - Number(at) < 3 * 24 * 60 * 60 * 1000));
  next[key] = now;
  try { localStorage.setItem(firedKey(userId), JSON.stringify(next)); } catch { /* 같은 알림이 한 번 더 뜰 수 있다. */ }
}

function reminderCopy({ schedule, startsAt }) {
  const minutes = Math.round((startsAt.getTime() - Date.now()) / 60000);
  const when = minutes > 0 ? `${minutes}분 후 시작` : '지금 시작';
  return { title: schedule.title, time: `${schedule.start}–${schedule.end}`, when, memo: schedule.memo.split('\n')[0] || '' };
}

async function showSystemNotification(reminder, copy) {
  if (typeof Notification !== 'function' || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const url = new URL(paperUrl(reminder.schedule.paper), window.location.href).href;
    await registration.showNotification(`문블 · ${copy.title}`.slice(0, 80), {
      body: [copy.time, copy.when, reminder.schedule.paper?.title, copy.memo].filter(Boolean).join(' · ').slice(0, 180),
      tag: `moonble-schedule-${reminder.schedule.id}`,
      icon: '/assets/moonble-app-icon-192.png',
      badge: '/assets/moonble-app-icon-192.png',
      data: { url },
    });
  } catch { /* 화면 알림 카드는 그대로 보인다. */ }
}

export function StudyReminders({ userId }) {
  const [reminder, setReminder] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    let items = [];
    const load = fresh => listSchedules(userId, { fresh }).then(result => { if (alive) items = result.items; }).catch(() => {});
    const check = () => {
      dueReminders(items).forEach(due => {
        const key = `${due.schedule.id}@${due.remindAt.toISOString()}`;
        if (readFired(userId)[key]) return;
        markFired(userId, key);
        const copy = reminderCopy(due);
        if (document.visibilityState === 'hidden') showSystemNotification(due, copy);
        if (alive) setReminder({ ...due, copy });
      });
    };
    load(false).then(check);
    const onChange = event => { if (!event.detail?.userId || event.detail.userId === userId) load(false).then(check); };
    const onVisible = () => { if (document.visibilityState === 'visible') load(true).then(check); };
    window.addEventListener('moonble:schedules-changed', onChange);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('moonble:schedules-changed', onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  if (!reminder) return null;
  const { schedule, copy } = reminder;
  return createPortal(<div className={`mb-reminder-toast is-${schedule.color}`} role="alert">
    <div className="mb-reminder-copy">
      <small>{copy.time} · {copy.when}</small>
      <strong>{copy.title}</strong>
      {(schedule.paper?.title || copy.memo) && <p>{schedule.paper?.title ? `예약한 문제지 · ${schedule.paper.title}` : copy.memo}</p>}
    </div>
    <div className="mb-reminder-actions">
      {schedule.paper
        ? <a className="is-primary" href={paperUrl(schedule.paper)} onClick={() => setReminder(null)}>문제 풀기</a>
        : <a href="./prd.html#/schedule" onClick={() => setReminder(null)}>시간표 보기</a>}
    </div>
    <button type="button" className="mb-reminder-close" aria-label="알림 닫기" onClick={() => setReminder(null)}><X size={16} aria-hidden="true" /></button>
  </div>, document.body);
}
