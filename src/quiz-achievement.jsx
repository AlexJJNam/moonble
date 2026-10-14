import React, { useEffect, useMemo, useState } from 'react';
import { Download, RotateCcw, Search, Trash2, Trophy } from 'lucide-react';

const HISTORY_KEY_PREFIX = 'moonble:user:';

function historyKey(userId) {
  return userId ? `${HISTORY_KEY_PREFIX}${userId}:history-v3` : null;
}

function readHistory(userId) {
  try {
    const key = historyKey(userId);
    const value = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    return Array.isArray(value) ? value.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeHistory(userId, history) {
  try {
    const key = historyKey(userId);
    if (key) localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
  } catch { /* 저장소가 제한된 환경에서는 현재 화면만 갱신한다. */ }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function ScoreChart({ history }) {
  const chronological = history.slice(0, 10).reverse();
  if (!chronological.length) return null;
  const width = 720;
  const height = 240;
  const inset = { top: 24, right: 24, bottom: 40, left: 40 };
  const innerWidth = width - inset.left - inset.right;
  const innerHeight = height - inset.top - inset.bottom;
  const x = index => inset.left + (chronological.length === 1 ? innerWidth / 2 : (innerWidth * index) / (chronological.length - 1));
  const y = score => inset.top + innerHeight * (1 - Math.max(0, Math.min(100, Number(score) || 0)) / 100);
  const points = chronological.map((item, index) => `${x(index)},${y(item.score)}`).join(' ');

  return <section className="achievement-chart" aria-labelledby="achievement-chart-title">
    <div className="achievement-section-heading"><div><h2 id="achievement-chart-title" className="mb-section-title">점수 추이</h2><p>최근 10회 기록을 오래된 순서부터 보여줘요.</p></div></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`최근 점수 추이: ${chronological.map(item => `${item.score}점`).join(', ')}`}>
      {[0, 50, 100].map(score => <g key={score}>
        <line className="achievement-chart-grid" x1={inset.left} x2={width - inset.right} y1={y(score)} y2={y(score)} />
        <text className="achievement-chart-label" x={inset.left - 10} y={y(score)} textAnchor="end" dominantBaseline="middle">{score}</text>
      </g>)}
      {chronological.length > 1 && <polyline className="achievement-chart-line" points={points} />}
      {chronological.map((item, index) => <g key={`${item.date}-${index}`}>
        <circle className="achievement-chart-dot" cx={x(index)} cy={y(item.score)} r="5"><title>{formatDate(item.date)} · {item.score}점</title></circle>
        <text className="achievement-chart-date" x={x(index)} y={height - 14} textAnchor="middle">{new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</text>
      </g>)}
    </svg>
  </section>;
}

export function QuizAchievement({ userId }) {
  const [history, setHistory] = useState(() => readHistory(userId));
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    const refresh = () => setHistory(readHistory(userId));
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [userId]);

  const stats = useMemo(() => {
    if (!history.length) return { latest: 0, average: 0, best: 0 };
    const scores = history.map(item => Number(item.score) || 0);
    return {
      latest: scores[0],
      average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      best: Math.max(...scores),
    };
  }, [history]);

  function update(next) {
    setHistory(next);
    writeHistory(userId, next);
    setConfirming(null);
  }

  function retry(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    try { sessionStorage.setItem('moonble:retry-question-ids', JSON.stringify(ids)); } catch { /* URL 이동은 계속한다. */ }
    window.location.href = './solve.html?paper=retry#quiz';
  }

  function exportHistory() {
    if (!history.length) return;
    const rows = [
      ['회차(최근기준)', '날짜', '점수', '정답수', '전체문항'],
      ...history.map((item, index) => [index + 1, item.date, item.score, item.correct, item.total]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `moonble_성취도_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="quiz-main achievement-main" id="achievement" tabIndex={-1}>
    <div className="quiz-title achievement-title">
      <div><h1 className="mb-page-title">나의 성취도</h1><p>최근 문제풀이 결과와 점수 변화를 확인해보세요.</p></div>
      <button className="achievement-export" type="button" disabled={!history.length} onClick={exportHistory}><Download size={18} aria-hidden="true" />CSV 내보내기</button>
    </div>

    {history.length ? <>
      <section className="achievement-summary" aria-label="성취도 요약">
        <article><span>최근 점수</span><strong>{stats.latest}<small>점</small></strong></article>
        <article><span>평균 점수</span><strong>{stats.average}<small>점</small></strong></article>
        <article><span>최고 점수</span><strong>{stats.best}<small>점</small></strong></article>
        <article><span>완료한 풀이</span><strong>{history.length}<small>회</small></strong></article>
      </section>
      <ScoreChart history={history} />
      <section className="achievement-history" aria-labelledby="achievement-history-title">
        <div className="achievement-section-heading">
          <div><h2 id="achievement-history-title" className="mb-section-title">최근 풀이 기록</h2><p>기록은 현재 기기에 계정별로 최대 10회까지 저장돼요.</p></div>
          {confirming === 'all' ? <div className="achievement-confirm"><span>모두 지울까요?</span><button onClick={() => setConfirming(null)}>취소</button><button className="danger" onClick={() => update([])}>초기화</button></div> : <button className="achievement-reset" type="button" onClick={() => setConfirming('all')}>전체 초기화</button>}
        </div>
        <ol className="achievement-list">
          {history.map((item, index) => <li key={`${item.date}-${index}`}>
            <span className="achievement-rank" aria-hidden="true">{index + 1}</span>
            <div className="achievement-attempt"><strong>{item.score}점 <small>({item.correct}/{item.total})</small></strong><time dateTime={item.date}>{formatDate(item.date)}</time></div>
            <div className="achievement-actions">
              <button type="button" disabled={!item.questionIds?.length} onClick={() => retry(item.questionIds)}><RotateCcw size={16} aria-hidden="true" />같은 문제</button>
              {item.wrongIds?.length > 0 && <button type="button" onClick={() => retry(item.wrongIds)}><Search size={16} aria-hidden="true" />오답만</button>}
              {confirming === index ? <><button onClick={() => setConfirming(null)}>취소</button><button className="danger" onClick={() => update(history.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></> : <button className="icon-button" type="button" aria-label={`${index + 1}회차 기록 삭제`} onClick={() => setConfirming(index)}><Trash2 size={17} aria-hidden="true" /></button>}
            </div>
          </li>)}
        </ol>
      </section>
    </> : <section className="achievement-empty">
      <span><Trophy size={30} aria-hidden="true" /></span>
      <h2 className="mb-card-title">아직 성취도 기록이 없어요</h2>
      <p>문제지를 풀고 제출하면 점수와 오답 기록이 여기에 쌓여요.</p>
      <a href="#paper-library">첫 문제지 풀기</a>
    </section>}
  </main>;
}
