import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
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
  const chronological = useMemo(() => history.slice(0, 10).reverse(), [history]);
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const gradientId = `achievement-area-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    const container = chartRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip || !chronological.length) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let lastWidth = 0;

    function hideTooltip() {
      tooltip.dataset.visible = 'false';
    }

    function showTooltip(event, item) {
      const point = event.currentTarget.getBoundingClientRect();
      const pointerX = Number.isFinite(event.clientX) && event.clientX ? event.clientX : point.left + point.width / 2;
      const pointerY = Number.isFinite(event.clientY) && event.clientY ? event.clientY : point.top;
      tooltip.textContent = `${formatDate(item.date)} · ${item.score}점 (${item.correct}/${item.total})`;
      tooltip.style.left = `${Math.min(window.innerWidth - 16, pointerX + 12)}px`;
      tooltip.style.top = `${Math.max(12, pointerY - 12)}px`;
      tooltip.dataset.visible = 'true';
    }

    function draw() {
      const width = Math.max(320, container.clientWidth || 320);
      if (container.querySelector('svg') && Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      const height = Math.max(230, Math.min(300, Math.round(width * .38)));
      const margin = { top: 20, right: 20, bottom: 38, left: 42 };
      const svg = d3.select(container).selectAll('svg').data([null]).join('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `최근 점수 추이: ${chronological.map(item => `${item.score}점`).join(', ')}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
      svg.selectAll('*').remove();
      svg.append('title').text('최근 10회 문제풀이 점수 추이');

      const x = d3.scalePoint()
        .domain(d3.range(chronological.length))
        .range([margin.left, width - margin.right])
        .padding(chronological.length === 1 ? .5 : .35);
      const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
      const ticks = [0, 25, 50, 75, 100];

      svg.selectAll('.achievement-chart-grid').data(ticks).enter().append('line')
        .attr('class', 'achievement-chart-grid')
        .attr('x1', margin.left).attr('x2', width - margin.right)
        .attr('y1', score => y(score)).attr('y2', score => y(score));
      svg.selectAll('.achievement-chart-label').data(ticks).enter().append('text')
        .attr('class', 'achievement-chart-label')
        .attr('x', margin.left - 10).attr('y', score => y(score))
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .text(score => score);
      svg.selectAll('.achievement-chart-date').data(chronological).enter().append('text')
        .attr('class', 'achievement-chart-date')
        .attr('x', (_, index) => x(index)).attr('y', height - 14)
        .attr('text-anchor', 'middle')
        .text(item => new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }));

      const gradient = svg.append('defs').append('linearGradient')
        .attr('id', gradientId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
      gradient.append('stop').attr('class', 'achievement-chart-area-stop-top').attr('offset', '0%');
      gradient.append('stop').attr('class', 'achievement-chart-area-stop-bottom').attr('offset', '100%');
      const area = d3.area()
        .x((_, index) => x(index)).y0(height - margin.bottom).y1(item => y(Number(item.score) || 0))
        .curve(d3.curveMonotoneX);
      const line = d3.line()
        .x((_, index) => x(index)).y(item => y(Number(item.score) || 0))
        .curve(d3.curveMonotoneX);

      const areaPath = svg.append('path').datum(chronological)
        .attr('class', 'achievement-chart-area').attr('fill', `url(#${gradientId})`).attr('d', area);
      const linePath = svg.append('path').datum(chronological)
        .attr('class', 'achievement-chart-line').attr('d', line);
      if (!reduceMotion) {
        areaPath.attr('opacity', 0).transition().duration(500).attr('opacity', 1);
        const length = linePath.node()?.getTotalLength() || 0;
        linePath.attr('stroke-dasharray', `${length} ${length}`).attr('stroke-dashoffset', length)
          .transition().duration(700).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);
      }

      const dots = svg.selectAll('.achievement-chart-dot').data(chronological).enter().append('circle')
        .attr('class', 'achievement-chart-dot')
        .attr('cx', (_, index) => x(index)).attr('cy', item => y(Number(item.score) || 0))
        .attr('r', reduceMotion ? 5 : 0).attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', item => `${formatDate(item.date)}, ${item.score}점, ${item.correct}/${item.total}개 정답`)
        .on('pointerenter focus', function (event, item) {
          d3.select(this).interrupt().transition().duration(140).attr('r', 7);
          showTooltip(event, item);
        })
        .on('pointermove', showTooltip)
        .on('pointerleave blur', function () {
          d3.select(this).interrupt().transition().duration(140).attr('r', 5);
          hideTooltip();
        });
      if (!reduceMotion) dots.transition().delay((_, index) => 350 + index * 45).duration(220).attr('r', 5);
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => { observer.disconnect(); d3.select(container).selectAll('*').interrupt(); };
  }, [chronological, gradientId]);

  if (!chronological.length) return null;

  return <section className="achievement-chart" aria-labelledby="achievement-chart-title">
    <div className="achievement-section-heading"><div><h2 id="achievement-chart-title" className="mb-section-title">점수 추이</h2><p>최근 10회 기록을 오래된 순서부터 보여줘요.</p></div></div>
    <div className="achievement-chart-canvas" ref={chartRef} />
    <div className="achievement-chart-tooltip" ref={tooltipRef} data-visible="false" role="status" />
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
