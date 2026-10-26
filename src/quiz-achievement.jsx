import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CalendarDays, Check, ChevronDown, Download, FileDown, RotateCcw, Search, Trash2, Trophy } from 'lucide-react';
import { DEFAULT_GROUP_ID, getCustomBankCollection } from './custom-bank.js';
import { BUILT_IN_PAPER_PREVIEWS, PaperPreview } from './paper-preview.jsx';
import { formatRelativeDate, formatRelativeDateShortYear } from './date-format.js';

const HISTORY_KEY_PREFIX = 'moonble:user:';
const PERIOD_OPTIONS = [['1m', '1개월'], ['3m', '3개월'], ['6m', '6개월'], ['all', '전체'], ['custom', '직접 선택']];

function dateInputValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function defaultCustomRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return [dateInputValue(from), dateInputValue(to)];
}

function historyKey(userId) {
  return userId ? `${HISTORY_KEY_PREFIX}${userId}:history-v3` : null;
}

function readHistory(userId) {
  try {
    const key = historyKey(userId);
    const value = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    return Array.isArray(value) ? value.slice(0, 200) : [];
  } catch {
    return [];
  }
}

function writeHistory(userId, history) {
  try {
    const key = historyKey(userId);
    if (key) localStorage.setItem(key, JSON.stringify(history.slice(0, 200)));
  } catch { /* 저장소가 제한된 환경에서는 현재 화면만 갱신한다. */ }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function formatSummaryRelativeDate(value) {
  return formatRelativeDateShortYear(value);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
  }).format(date);
}

function historyPaperKey(item) {
  if (item?.bankId) return `bank:${item.bankId}`;
  if (item?.paperId) return `paper:${item.paperId}`;
  return `title:${item?.paperTitle || '문제지'}`;
}

function fallbackPaperTitle(item) {
  const savedTitle = item?.paperTitle?.trim();
  if (savedTitle && savedTitle !== '문제지') return savedTitle;
  if (item?.paperId === 'basics') return 'GA4 핵심 개념';
  if (item?.paperId === 'advanced') return 'GA4 실무 응용';
  if (item?.paperId === 'random') return '전체 랜덤 문제지';
  if (item?.paperId === 'custom') return '내 문제지';
  return '전체 랜덤 문제지';
}

function ScoreChart({ history }) {
  const chronological = useMemo(() => history.slice(0, 10).reverse(), [history]);
  const trendData = useMemo(() => {
    return chronological.map((item, index) => {
      const score = Number(item.score) || 0;
      const scores = chronological.slice(0, index + 1).map(record => Number(record.score) || 0);
      const recent3Scores = scores.slice(-3);
      const recent10Scores = scores.slice(-10);
      const average = values => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      return { ...item, score, recent3: average(recent3Scores), recent10: average(recent10Scores) };
    });
  }, [chronological]);
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const container = chartRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip || !trendData.length) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let lastWidth = 0;

    function hideTooltip() {
      tooltip.dataset.visible = 'false';
    }

    function showTooltip(event, item) {
      const point = event.currentTarget.getBoundingClientRect();
      const pointerX = Number.isFinite(event.clientX) && event.clientX ? event.clientX : point.left + point.width / 2;
      const pointerY = Number.isFinite(event.clientY) && event.clientY ? event.clientY : point.top;
      tooltip.textContent = `${formatDate(item.date)} · ${item.score}점 · 최근 3회 ${item.recent3}점 · 장기 추세 ${item.recent10}점`;
      tooltip.style.left = `${Math.min(window.innerWidth - 16, pointerX + 12)}px`;
      tooltip.style.top = `${Math.max(12, pointerY - 12)}px`;
      tooltip.dataset.visible = 'true';
    }

    function draw({ animate = false, force = false } = {}) {
      const compact = window.matchMedia?.('(max-width: 540px)').matches;
      const measuredWidth = container.clientWidth || (compact ? 320 : 680);
      const width = compact ? Math.max(300, measuredWidth) : Math.max(680, measuredWidth);
      if (container.querySelector('svg') && Math.abs(width - lastWidth) < 1 && !force) return;
      lastWidth = width;
      const shouldAnimate = animate && !reduceMotion;
      const height = compact ? Math.max(224, Math.min(248, Math.round(width * .72))) : Math.max(260, Math.min(320, Math.round(width * .38)));
      const margin = compact
        ? { top: 22, right: 10, bottom: 38, left: 30 }
        : { top: 24, right: 24, bottom: 44, left: 44 };
      const svg = d3.select(container).selectAll('svg').data([null]).join('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .classed('is-compact', compact)
        .attr('role', 'img')
        .attr('aria-label', `최근 점수와 실력 추이: ${trendData.map(item => `${item.score}점`).join(', ')}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
      svg.selectAll('*').remove();
      svg.append('title').text('최근 문제풀이 점수와 3회·10회 이동평균 추이');

      const x = d3.scaleBand()
        .domain(d3.range(trendData.length))
        .range([margin.left, width - margin.right])
        .paddingInner(compact ? .5 : .62)
        .paddingOuter(.32);
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
      svg.selectAll('.achievement-chart-date').data(trendData).enter().append('text')
        .attr('class', 'achievement-chart-date')
        .attr('x', (_, index) => x(index) + x.bandwidth() / 2).attr('y', height - 14)
        .attr('text-anchor', 'middle')
        .text(item => new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }));

      const bars = svg.selectAll('.achievement-chart-bar').data(trendData).enter().append('rect')
        .attr('class', 'achievement-chart-bar')
        .attr('x', (_, index) => x(index))
        .attr('width', x.bandwidth())
        .attr('y', item => shouldAnimate ? y(0) : y(item.score))
        .attr('height', item => shouldAnimate ? 0 : Math.max(0, y(0) - y(item.score)))
        .attr('rx', compact ? 4 : 5)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', item => `${formatDate(item.date)}, ${item.score}점, ${item.correct}/${item.total}개 정답`)
        .on('pointerenter focus', function (event, item) {
          d3.select(this).classed('is-active', true);
          showTooltip(event, item);
        })
        .on('pointermove', showTooltip)
        .on('pointerleave blur', function () {
          d3.select(this).classed('is-active', false);
          hideTooltip();
        });
      if (shouldAnimate) {
        bars.transition().delay((_, index) => index * 36).duration(460).ease(d3.easeCubicOut)
          .attr('y', item => y(item.score))
          .attr('height', item => Math.max(0, y(0) - y(item.score)));
      }

      const movingAverageLine = key => d3.line()
        .x((_, index) => x(index) + x.bandwidth() / 2).y(item => y(item[key]))
        .curve(d3.curveMonotoneX);

      const longLinePath = svg.append('path').datum(trendData)
        .attr('class', 'achievement-chart-line achievement-chart-line-long').attr('d', movingAverageLine('recent10'));
      const shortLinePath = svg.append('path').datum(trendData)
        .attr('class', 'achievement-chart-line achievement-chart-line-short').attr('d', movingAverageLine('recent3'));
      if (shouldAnimate) {
        [longLinePath, shortLinePath].forEach((path, index) => {
          const length = path.node()?.getTotalLength() || 0;
          path.attr('stroke-dasharray', `${length} ${length}`).attr('stroke-dashoffset', length)
            .transition().delay(180 + index * 100).duration(700).ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0)
            .on('end', () => {
              if (index === 0) path.attr('stroke-dasharray', '6 6');
            });
        });
      }

      const dots = svg.selectAll('.achievement-chart-dot').data(trendData).enter().append('circle')
        .attr('class', 'achievement-chart-dot')
        .attr('cx', (_, index) => x(index) + x.bandwidth() / 2).attr('cy', item => y(item.recent3))
        .attr('r', shouldAnimate ? 0 : 4).attr('tabindex', 0).attr('role', 'img')
        .attr('aria-label', item => `${formatDate(item.date)}, 최근 3회 평균 ${item.recent3}점, 장기 추세 ${item.recent10}점`)
        .on('pointerenter focus', function (event, item) {
          d3.select(this).interrupt().transition().duration(140).attr('r', 6);
          showTooltip(event, item);
        })
        .on('pointermove', showTooltip)
        .on('pointerleave blur', function () {
          d3.select(this).interrupt().transition().duration(140).attr('r', 4);
          hideTooltip();
        });
      if (shouldAnimate) dots.transition().delay((_, index) => 520 + index * 42).duration(220).ease(d3.easeBackOut.overshoot(1.3)).attr('r', 4);
    }

    draw({ force: true });
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(container);
    let revealObserver;
    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          draw({ animate: true, force: true });
          revealObserver.disconnect();
        }
      }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
      revealObserver.observe(container);
    } else {
      draw({ animate: true, force: true });
    }
    return () => { resizeObserver.disconnect(); revealObserver?.disconnect(); d3.select(container).selectAll('*').interrupt(); };
  }, [trendData]);

  if (!trendData.length) return null;

  const latest = trendData.at(-1);
  const previous = trendData.at(-2);
  const trendGap = latest.recent3 - latest.recent10;
  const previousGap = previous ? previous.recent3 - previous.recent10 : 0;
  const recentChange = previous ? latest.recent3 - previous.recent3 : 0;
  const crossedUp = trendData.length >= 5 && trendGap > 0 && previousGap <= 0;
  const trendCopy = trendData.length < 5
    ? `현재 ${trendData.length}회 기록이 있어요. 5회 이상 쌓이면 최근 성장세를 더 정확히 비교할 수 있어요.`
    : crossedUp
      ? `최근 성장세가 장기 추세를 넘어섰어요. 최근 3회 평균은 ${latest.recent3}점이에요.`
      : trendGap >= 3
        ? `최근 3회 평균이 장기 추세보다 ${trendGap}점 높아요. 상승 흐름이 이어지고 있어요.`
        : trendGap > 0
          ? `최근 3회 평균이 장기 추세보다 ${trendGap}점 높아요.`
          : recentChange > 0
            ? `최근 3회 평균이 직전 추세보다 ${recentChange}점 올랐어요.`
            : trendGap <= -3
              ? `최근 3회 평균이 장기 추세보다 ${Math.abs(trendGap)}점 낮아요. 취약 영역을 다시 확인해보세요.`
              : `최근 성장세가 장기 추세와 비슷하게 유지되고 있어요.`;

  return <section className="achievement-chart" aria-labelledby="achievement-chart-title">
    <div className="achievement-section-heading">
      <div><h2 id="achievement-chart-title" className="mb-section-title">실력 추세</h2><p>{trendCopy}</p></div>
      <div className="achievement-legend" aria-label="그래프 범례"><span><i className="score" />회차 점수</span><span><i className="recent" />최근 3회</span><span><i className="long-term" />최근 10회</span></div>
    </div>
    <div className="achievement-chart-scroll" tabIndex={0} aria-label="점수 추이 그래프와 표, 가로로 이동 가능">
      <div className="achievement-chart-track" style={{ '--achievement-point-count': trendData.length }}>
        <div className="achievement-chart-canvas" ref={chartRef} />
        <table className="achievement-chart-table">
          <caption className="mb-sr-only">최근 문제풀이 점수와 3회·10회 이동평균</caption>
          <thead><tr><th scope="col">기록</th>{trendData.map((item, index) => <th scope="col" key={`${item.date}-date-${index}`}>{formatShortDate(item.date)}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row"><i className="score" />점수</th>{trendData.map((item, index) => <td key={`${item.date}-score-${index}`}>{item.score}점</td>)}</tr>
            <tr><th scope="row"><i className="recent" />최근 3회</th>{trendData.map((item, index) => <td key={`${item.date}-recent3-${index}`}>{item.recent3}점</td>)}</tr>
            <tr><th scope="row"><i className="long-term" />최근 10회</th>{trendData.map((item, index) => <td key={`${item.date}-recent10-${index}`}>{item.recent10}점</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
    <div className="achievement-chart-tooltip" ref={tooltipRef} data-visible="false" role="status" />
  </section>;
}

export function QuizAchievement({ userId }) {
  const [history, setHistory] = useState(() => readHistory(userId));
  const [confirming, setConfirming] = useState(null);
  const [collection, setCollection] = useState(() => getCustomBankCollection(userId));
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedPapers, setSelectedPapers] = useState([]);
  const [period, setPeriod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [periodSheetClosing, setPeriodSheetClosing] = useState(false);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [periodDraft, setPeriodDraft] = useState('all');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [periodError, setPeriodError] = useState('');
  const periodFilterRef = useRef(null);
  const periodTriggerRef = useRef(null);
  const periodOverlayRef = useRef(null);
  const periodSheetRef = useRef(null);
  const periodCloseTimerRef = useRef(0);

  useEffect(() => {
    const refresh = () => {
      setHistory(readHistory(userId));
      setCollection(getCustomBankCollection(userId));
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [userId]);

  useEffect(() => {
    if (!customPopoverOpen && !periodSheetOpen) return undefined;
    function handlePointerDown(event) {
      if (customPopoverOpen && !periodFilterRef.current?.contains(event.target)) setCustomPopoverOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      setCustomPopoverOpen(false);
      closePeriodSheet();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [customPopoverOpen, periodSheetOpen]);

  useEffect(() => {
    if (!periodSheetOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const placeSheet = () => {
      const keyboardOffset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      periodOverlayRef.current?.style.setProperty('--achievement-keyboard-offset', `${keyboardOffset}px`);
    };
    placeSheet();
    viewport?.addEventListener('resize', placeSheet);
    viewport?.addEventListener('scroll', placeSheet);
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener('resize', placeSheet);
      viewport?.removeEventListener('scroll', placeSheet);
    };
  }, [periodSheetOpen]);

  useEffect(() => () => window.clearTimeout(periodCloseTimerRef.current), []);

  const groupFilters = useMemo(() => [
    { id: DEFAULT_GROUP_ID, name: '미분류' },
    ...collection.groups,
  ].map(group => ({
    ...group,
    count: history.filter(item => (item.groupId || DEFAULT_GROUP_ID) === group.id).length,
  })), [collection.groups, history]);

  const paperFilters = useMemo(() => {
    const bankTitles = new Map(collection.banks.map(bank => [bank.id, bank.title]));
    const filters = new Map();
    history.forEach(item => {
      const groupId = item.groupId || DEFAULT_GROUP_ID;
      if (selectedGroups.length && !selectedGroups.includes(groupId)) return;
      const id = historyPaperKey(item);
      const current = filters.get(id);
      if (current) {
        current.count += 1;
        return;
      }
      filters.set(id, {
        id,
        name: item.bankId ? (bankTitles.get(item.bankId) || fallbackPaperTitle(item)) : fallbackPaperTitle(item),
        count: 1,
      });
    });
    return [...filters.values()];
  }, [collection.banks, history, selectedGroups]);

  const historyPaperDetails = item => {
    const bank = item.bankId ? collection.banks.find(candidate => candidate.id === item.bankId) : null;
    const builtIn = BUILT_IN_PAPER_PREVIEWS.find(candidate => candidate.id === item.paperId);
    const savedTitle = item.paperTitle?.trim();
    return {
      title: savedTitle && savedTitle !== '문제지' ? savedTitle : (bank?.title || fallbackPaperTitle(item)),
      description: item.paperDescription?.trim() || bank?.description || builtIn?.description || '',
      bank,
      builtIn,
    };
  };

  const previewForHistory = item => {
    const { title, bank, builtIn } = historyPaperDetails(item);
    const source = bank || builtIn;
    return {
      kind: bank ? 'custom' : (source?.kind || 'custom'),
      label: title,
      count: bank?.questions.length || source?.count || Number(item.total) || item.questionIds?.length || 20,
      samples: bank
        ? bank.questions.slice(0, 2).map(question => ({ title: question.q, options: question.options.slice(0, 3) }))
        : (source?.samples || []),
    };
  };

  useEffect(() => {
    if (!selectedGroups.length) {
      setSelectedPapers(current => current.length ? [] : current);
      return;
    }
    const available = new Set(paperFilters.map(paper => paper.id));
    setSelectedPapers(current => {
      const next = current.filter(id => available.has(id));
      return next.length === current.length ? current : next;
    });
  }, [paperFilters, selectedGroups.length]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (period === '1m') start.setMonth(start.getMonth() - 1);
    if (period === '3m') start.setMonth(start.getMonth() - 3);
    if (period === '6m') start.setMonth(start.getMonth() - 6);
    return history.filter(item => {
      const groupMatch = !selectedGroups.length || selectedGroups.includes(item.groupId || DEFAULT_GROUP_ID);
      const paperMatch = !selectedPapers.length || selectedPapers.includes(historyPaperKey(item));
      const itemDate = new Date(item.date);
      if (!groupMatch || !paperMatch || Number.isNaN(itemDate.getTime())) return false;
      if (period === 'custom') {
        const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
        return (!from || itemDate >= from) && (!to || itemDate <= to);
      }
      return period === 'all' || itemDate >= start;
    });
  }, [dateFrom, dateTo, history, period, selectedGroups, selectedPapers]);

  const stats = useMemo(() => {
    if (!filteredHistory.length) return { latest: 0, average: 0, best: 0, latestDate: '-' };
    const scores = filteredHistory.map(item => Number(item.score) || 0);
    return {
      latest: scores[0],
      average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      best: Math.max(...scores),
      latestDate: formatSummaryRelativeDate(filteredHistory[0].date),
    };
  }, [filteredHistory]);

  function update(next) {
    setHistory(next);
    writeHistory(userId, next);
    setConfirming(null);
  }

  function prepareCustomRange() {
    const [fallbackFrom, fallbackTo] = defaultCustomRange();
    setDraftFrom(dateFrom || fallbackFrom);
    setDraftTo(dateTo || fallbackTo);
    setPeriodError('');
  }

  function chooseDesktopPeriod(value) {
    if (value === 'custom') {
      prepareCustomRange();
      setCustomPopoverOpen(current => !current);
      return;
    }
    setPeriod(value);
    setCustomPopoverOpen(false);
  }

  function openPeriodSheet() {
    window.clearTimeout(periodCloseTimerRef.current);
    setPeriodDraft(period);
    prepareCustomRange();
    setPeriodSheetClosing(false);
    setPeriodSheetOpen(true);
  }

  function closePeriodSheet() {
    if (!periodSheetOpen || periodSheetClosing) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setPeriodSheetClosing(true);
    window.clearTimeout(periodCloseTimerRef.current);
    periodCloseTimerRef.current = window.setTimeout(() => {
      setPeriodSheetOpen(false);
      setPeriodSheetClosing(false);
      periodTriggerRef.current?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 190);
  }

  function chooseMobilePeriod(value) {
    if (value === 'custom') {
      setPeriodDraft('custom');
      setPeriodError('');
      window.requestAnimationFrame(() => periodSheetRef.current?.querySelector('input[type="date"]')?.focus({ preventScroll: true }));
      return;
    }
    setPeriod(value);
    setPeriodDraft(value);
    closePeriodSheet();
  }

  function applyCustomPeriod() {
    if (!draftFrom || !draftTo) {
      setPeriodError('시작일과 종료일을 모두 골라주세요.');
      return;
    }
    if (draftFrom > draftTo) {
      setPeriodError('시작일이 종료일보다 늦어요.');
      return;
    }
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setPeriod('custom');
    setPeriodDraft('custom');
    setPeriodError('');
    if (periodSheetOpen) closePeriodSheet();
    setCustomPopoverOpen(false);
  }

  const selectedPeriodLabel = period === 'custom' && dateFrom && dateTo
    ? `${dateFrom.slice(5).replace('-', '.')} ~ ${dateTo.slice(5).replace('-', '.')}`
    : PERIOD_OPTIONS.find(([value]) => value === period)?.[1] || '전체';

  function retry(item, ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    try {
      sessionStorage.setItem('moonble:retry-question-ids', JSON.stringify(ids));
      const paper = historyPaperDetails(item);
      sessionStorage.setItem('moonble:retry-meta', JSON.stringify({ paperId: item.paperId, bankId: item.bankId, groupId: item.groupId, paperTitle: paper.title, paperDescription: paper.description }));
    } catch { /* URL 이동은 계속한다. */ }
    window.location.href = './solve.html?paper=retry#quiz';
  }

  function exportHistory() {
    if (!filteredHistory.length) return;
    const rows = [
      ['회차(최근기준)', '날짜', '점수', '정답수', '전체문항'],
      ...filteredHistory.map((item, index) => [index + 1, item.date, item.score, item.correct, item.total]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `moonble_성취도_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  const todayValue = dateInputValue(new Date());

  return <main className="quiz-main mb-page-gutter achievement-main" id="achievement" tabIndex={-1}>
    <div className="quiz-title achievement-title">
      <div><h1 className="mb-page-title">나의 성취도</h1></div>
    </div>

    {history.length ? <>
      <section className="achievement-filters" aria-label="성취도 조회 조건">
        <div className="achievement-group-depth">
          <span className="achievement-filter-label">그룹</span>
          <div className="achievement-group-filters" role="group" aria-label="문제지 그룹 복수 선택">
            <button className={!selectedGroups.length ? 'is-active' : ''} type="button" aria-pressed={!selectedGroups.length} onClick={() => setSelectedGroups([])}>전체 <small>{history.length}</small></button>
            {groupFilters.map(group => <button className={selectedGroups.includes(group.id) ? 'is-active' : ''} type="button" aria-pressed={selectedGroups.includes(group.id)} disabled={!group.count} key={group.id} onClick={() => setSelectedGroups(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])}>{group.name} <small>{group.count}</small></button>)}
          </div>
        </div>
        {selectedGroups.length > 0 && paperFilters.length > 0 && <div className="achievement-paper-depth">
          <span className="achievement-filter-label">문제지</span>
          <div className="achievement-paper-filters" role="group" aria-label="선택한 그룹의 문제지 복수 선택">
            <button className={!selectedPapers.length ? 'is-active' : ''} type="button" aria-pressed={!selectedPapers.length} onClick={() => setSelectedPapers([])}>전체 <small>{paperFilters.reduce((sum, paper) => sum + paper.count, 0)}</small></button>
            {paperFilters.map(paper => <button className={selectedPapers.includes(paper.id) ? 'is-active' : ''} type="button" aria-pressed={selectedPapers.includes(paper.id)} key={paper.id} onClick={() => setSelectedPapers(current => current.includes(paper.id) ? current.filter(id => id !== paper.id) : [...current, paper.id])}>{paper.name} <small>{paper.count}</small></button>)}
          </div>
        </div>}
        <div className="achievement-period-filter" ref={periodFilterRef}>
          <span className="achievement-period-label">기간</span>
          <span className="achievement-period-icon"><CalendarDays size={17} aria-hidden="true" /></span>
          <div className="achievement-period-tabs" role="group" aria-label="조회 기간">
            {PERIOD_OPTIONS.filter(([value]) => value !== 'custom').map(([value, label]) => <button className={period === value ? 'is-active' : ''} type="button" aria-pressed={period === value} onClick={() => chooseDesktopPeriod(value)} key={value}>{label}</button>)}
          </div>
          <div className="achievement-custom-anchor">
            <button className={period === 'custom' || customPopoverOpen ? 'is-active' : ''} type="button" aria-pressed={period === 'custom'} aria-haspopup="dialog" aria-expanded={customPopoverOpen} onClick={() => chooseDesktopPeriod('custom')}>직접 선택</button>
            {customPopoverOpen && <div className="achievement-custom-popover" role="dialog" aria-label="직접 조회 기간 선택">
              <div className="achievement-date-range"><label><span>시작일</span><input type="date" value={draftFrom} max={draftTo || todayValue} onChange={event => { setDraftFrom(event.target.value); setPeriodError(''); }} /></label><i aria-hidden="true">~</i><label><span>종료일</span><input type="date" value={draftTo} min={draftFrom || undefined} max={todayValue} onChange={event => { setDraftTo(event.target.value); setPeriodError(''); }} /></label></div>
              {periodError && <p role="alert">{periodError}</p>}
              <button type="button" onClick={applyCustomPeriod}>이 기간으로 보기</button>
            </div>}
          </div>
          <button className="achievement-period-mobile-trigger" ref={periodTriggerRef} type="button" aria-haspopup="dialog" aria-expanded={periodSheetOpen} onClick={openPeriodSheet}>{selectedPeriodLabel}<ChevronDown size={15} aria-hidden="true" /></button>
        </div>
      </section>
      {filteredHistory.length ? <>
      <section className="achievement-performance" aria-labelledby="achievement-performance-title">
        <div className="achievement-section-heading"><div><h2 id="achievement-performance-title" className="mb-section-title">학습 실적</h2></div></div>
        <div className="achievement-summary" aria-label="성취도 요약">
          <article><span>최근 풀이</span><strong className="achievement-summary-date">{stats.latestDate}</strong><small>{filteredHistory.length}회 완료</small></article>
          <article><span>최근 점수</span><strong>{stats.latest}<small>점</small></strong></article>
          <article><span>평균 점수</span><strong>{stats.average}<small>점</small></strong></article>
          <article><span>최고 점수</span><strong>{stats.best}<small>점</small></strong></article>
        </div>
      </section>
      <ScoreChart history={filteredHistory} />
      <section className="achievement-history" aria-labelledby="achievement-history-title">
        <div className="achievement-section-heading">
          <div><h2 id="achievement-history-title" className="mb-section-title">최근 풀이 기록</h2><p>선택한 조건에 맞는 기록 {filteredHistory.length}건이에요.</p></div>
          {confirming === 'all' ? <div className="achievement-confirm"><span>모두 지울까요?</span><button onClick={() => setConfirming(null)}>취소</button><button className="danger" onClick={() => update([])}>초기화</button></div> : <button className="achievement-reset" type="button" onClick={() => setConfirming('all')}>전체 초기화</button>}
        </div>
        <ol className="achievement-list">
          {filteredHistory.map((item, index) => {
            const paper = historyPaperDetails(item);
            return <li key={`${item.date}-${index}`}>
              <span className="achievement-rank" aria-hidden="true">{index + 1}</span>
              <div className="achievement-paper-thumb" role="img" aria-label={`${paper.title} 문제지 미리보기`}><PaperPreview paper={previewForHistory(item)} compact /></div>
              <div className="achievement-attempt">
                <div className="achievement-attempt-score"><span className="achievement-score-badge">{item.score}점</span><small>({item.correct}/{item.total})</small></div>
                <strong className="achievement-paper-title" title={paper.title}>{paper.title}</strong>
                {paper.description && <p className="achievement-paper-description" title={paper.description}>{paper.description}</p>}
                <time dateTime={item.date}>{formatDate(item.date)}</time>
              </div>
              <div className="achievement-actions">
                <button type="button" disabled={!item.questionIds?.length} onClick={() => retry(item, item.questionIds)}><RotateCcw size={16} aria-hidden="true" />같은 문제</button>
                {item.wrongIds?.length > 0 && <button type="button" onClick={() => retry(item, item.wrongIds)}><Search size={16} aria-hidden="true" />오답만</button>}
                {confirming === item.date ? <><button onClick={() => setConfirming(null)}>취소</button><button className="danger" onClick={() => update(history.filter(record => record !== item))}>삭제</button></> : <button className="icon-button" type="button" aria-label={`${index + 1}회차 기록 삭제`} onClick={() => setConfirming(item.date)}><Trash2 size={17} aria-hidden="true" /></button>}
              </div>
            </li>;
          })}
        </ol>
      </section>
      </> : <section className="achievement-filter-empty"><Search size={26} aria-hidden="true" /><h2>선택한 조건의 기록이 없어요</h2><p>그룹·문제지나 기간을 바꾸면 다른 풀이 기록을 확인할 수 있어요.</p><button type="button" onClick={() => { setSelectedGroups([]); setSelectedPapers([]); setPeriod('all'); setDateFrom(''); setDateTo(''); }}>전체 기록 보기</button></section>}
    </> : <section className="achievement-empty">
      <span><Trophy size={30} aria-hidden="true" /></span>
      <h2 className="mb-card-title">아직 성취도 기록이 없어요</h2>
      <p>문제지를 풀고 제출하면 점수와 오답 기록이 여기에 쌓여요.</p>
      <a href="#paper-library">첫 문제지 풀기</a>
    </section>}
    {filteredHistory.length > 0 && <section className="achievement-bottom-tools" aria-label="성취도 내보내기">
      <div className="achievement-export-actions" aria-label="학습 리포트 내보내기">
        <button className="achievement-export" type="button" onClick={exportHistory}><Download size={17} aria-hidden="true" />CSV</button>
        <button className="achievement-export" type="button" onClick={exportPdf}><FileDown size={17} aria-hidden="true" />PDF</button>
      </div>
    </section>}
    {periodSheetOpen && <div ref={periodOverlayRef} className={`achievement-period-overlay${periodSheetClosing ? ' is-closing' : ''}`} role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) closePeriodSheet(); }}>
      <section ref={periodSheetRef} className={`achievement-period-sheet${periodDraft === 'custom' ? ' show-custom' : ''}`} role="dialog" aria-modal="true" aria-labelledby="achievement-period-title">
        <span className="achievement-period-grab" aria-hidden="true" />
        <h2 id="achievement-period-title">조회 기간</h2>
        <div className="achievement-period-options" role="radiogroup" aria-label="조회 기간">
          {PERIOD_OPTIONS.map(([value, label]) => <button className={periodDraft === value ? 'is-active' : ''} type="button" role="radio" aria-checked={periodDraft === value} onClick={() => chooseMobilePeriod(value)} key={value}><span>{label}</span><i aria-hidden="true"><Check size={14} /></i></button>)}
        </div>
        <div className="achievement-period-custom" aria-hidden={periodDraft !== 'custom'}>
          <div className="achievement-date-range"><label><span>시작일</span><input type="date" value={draftFrom} max={draftTo || todayValue} onChange={event => { setDraftFrom(event.target.value); setPeriodError(''); }} /></label><i aria-hidden="true">~</i><label><span>종료일</span><input type="date" value={draftTo} min={draftFrom || undefined} max={todayValue} onChange={event => { setDraftTo(event.target.value); setPeriodError(''); }} /></label></div>
          <p className={periodError ? 'is-error' : ''} role={periodError ? 'alert' : undefined}>{periodError || '원하는 시작일과 종료일을 선택하세요.'}</p>
          <button type="button" onClick={applyCustomPeriod}>이 기간으로 보기</button>
        </div>
      </section>
    </div>}
  </main>;
}
