import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BarChart3, Bell, BookOpen, ChevronDown, ChevronLeft, FileText, LogOut, PanelLeftClose, PanelLeftOpen, PenLine, Settings2, Sparkles, UserRound } from 'lucide-react';
import { profileOf } from './profile.js';
import { UserAvatar } from './user-avatar.jsx';
import { BrandLogo } from './brand-logo.jsx';
import { BUILT_IN_PAPER_PREVIEWS } from './paper-preview.jsx';
import { QuizPreviewDialog, previewPaperFromQuestions } from './quiz-preview-dialog.jsx';
import { StudyReminders } from './schedule/schedule-reminders.jsx';
import { DEFAULT_GROUP_ID, getCustomBankCollection } from './custom-bank.js';
import { getFavoritePaperIds, getLikedPublicQuizzes } from './paper-favorites.js';
import { getMyPublicQuizLikedTokens } from './public-quiz-likes.js';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE } from './public-quizzes-api.js';
import { enableBrowserNotifications as requestBrowserNotifications, getBrowserNotificationSettings } from './browser-notifications.js';
import { getNextQuizShareNotification, getQuizShare } from './quiz-share.js';
import { formatRelativeDate } from './date-format.js';
import { supabase } from './supabase.js';
import { quizMemoPaperKey, readQuizMemos, removeQuizMemo } from './quiz-memos.js';
import './app-header.css';

const SHARE_NOTIFICATION_LIMIT = 40;

function shareNotificationStorageKey(userId) {
  return userId ? `moonble:user:${userId}:quiz-share-notifications-v1` : null;
}

function readShareNotifications(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(shareNotificationStorageKey(userId)) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string').slice(0, SHARE_NOTIFICATION_LIMIT) : [];
  } catch { return []; }
}

function rememberShareNotification(userId, notification) {
  const previous = readShareNotifications(userId);
  if (previous.some(item => item.id === notification.id)) return previous;
  const next = [{ ...notification, seen: false }, ...previous].slice(0, SHARE_NOTIFICATION_LIMIT);
  try { localStorage.setItem(shareNotificationStorageKey(userId), JSON.stringify(next)); }
  catch { /* 기록을 저장하지 못해도 새 알림은 현재 화면에 표시한다. */ }
  return next;
}

function markShareNotificationsSeen(userId, notifications) {
  const next = notifications.map(notification => ({ ...notification, seen: true }));
  try { localStorage.setItem(shareNotificationStorageKey(userId), JSON.stringify(next)); }
  catch { /* 알림 목록은 현재 화면에서 계속 볼 수 있다. */ }
  return next;
}

function getFavoriteSidebarItems(userId) {
  if (!userId) return [];
  const favoriteIds = getFavoritePaperIds(userId);
  const collection = getCustomBankCollection(userId);
  const banks = collection.banks;
  const builtInPapers = new Map(BUILT_IN_PAPER_PREVIEWS.map(paper => [paper.id, paper]));
  const favoritePapers = favoriteIds.map(id => {
    if (id.startsWith('custom:')) {
      const bank = banks.find(item => item.id === id.slice('custom:'.length));
      const group = bank && collection.groups.find(item => item.id === bank.groupId);
      return bank ? { id, type: 'paper', label: bank.title, caption: bank.groupId === DEFAULT_GROUP_ID ? '미분류' : (group?.name || '미분류'), href: `./solve.html?paper=custom&bank=${encodeURIComponent(bank.id)}#quiz`, preview: () => previewPaperFromQuestions({ title: bank.title, description: bank.description || '', questions: Array.isArray(bank.questions) ? bank.questions : [] }) } : null;
    }
    const paper = builtInPapers.get(id);
    return paper ? { id, type: 'paper', label: paper.label, href: `./solve.html?paper=${encodeURIComponent(paper.id)}#quiz`, preview: () => paper } : null;
  }).filter(Boolean);

  let favoritePrds = [];
  try {
    const savedPrds = JSON.parse(localStorage.getItem(`moonble:${userId}:prds`) || '[]');
    if (Array.isArray(savedPrds)) {
      const latestByDocument = new Map();
      savedPrds.forEach(prd => {
        if (!prd || typeof prd.documentId !== 'string' || !prd.documentId || prd.isFavorite !== true) return;
        const previous = latestByDocument.get(prd.documentId);
        if (!previous || Number.parseFloat(prd.version) > Number.parseFloat(previous.version)) {
          latestByDocument.set(prd.documentId, prd);
        }
      });
      favoritePrds = Array.from(latestByDocument.values()).map(prd => ({
        id: `prd:${prd.documentId}`,
        type: 'prd',
        label: typeof prd.title === 'string' && prd.title.trim() ? prd.title : '제목 없는 PRD',
        href: `./prd.html#/edit/${encodeURIComponent(prd.id)}`,
      }));
    }
  } catch { /* 저장된 PRD가 없거나 손상되어도 문제지 즐겨찾기는 표시한다. */ }

  return [...favoritePapers, ...favoritePrds];
}

function getLocalScrapSidebarItems(userId) {
  return getLikedPublicQuizzes(userId).map(item => ({
    id: `scrap:${item.token}`,
    type: 'scrap',
    label: item.title || '스크랩한 문제지',
    href: `./solve.html#share=${encodeURIComponent(item.token)}`,
    preview: () => getQuizShare(item.token).then(share => previewPaperFromQuestions(share)),
  }));
}

function useSolverQuestions(enabled) {
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef(null);
  const manualSelectionUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;

    function readCards() {
      const container = document.getElementById('quizContainer');
      if (!container) {
        setItems([]);
        return;
      }
      const next = Array.from(container.querySelectorAll('.q-card')).map((card, index) => {
        card.id = `question-${index + 1}`;
        card.tabIndex = -1;
        const number = card.querySelector('.q-number');
        const status = number?.classList.contains('right')
          ? 'correct'
          : number?.classList.contains('wrong')
            ? 'wrong'
            : card.querySelector('.option-card.selected') ? 'answered' : 'idle';
        return {
          id: card.id,
          label: `문제 ${index + 1}번`,
          status,
        };
      });
      setItems(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setActiveIndex(current => Math.min(current, Math.max(0, next.length - 1)));
    }

    function updateActive() {
      frame = 0;
      if (Date.now() < manualSelectionUntil.current) return;
      const container = document.getElementById('quizContainer');
      if (!container) return;
      const cards = Array.from(container.querySelectorAll('.q-card'));
      if (!cards.length) return;
      const header = document.querySelector('.mb-app-header');
      const top = window.matchMedia('(max-width: 767px)').matches && header
        ? header.getBoundingClientRect().height + 16
        : 24;
      let best = 0;
      let bestDistance = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.top - top);
        if (rect.bottom > top && distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      setActiveIndex(best);
    }

    function scheduleActive() {
      if (frame) return;
      frame = requestAnimationFrame(updateActive);
    }

    const observer = new MutationObserver(() => {
      readCards();
      scheduleActive();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    readCards();
    updateActive();
    window.addEventListener('scroll', scheduleActive, { passive: true });
    window.addEventListener('resize', scheduleActive);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scheduleActive);
      window.removeEventListener('resize', scheduleActive);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector('[aria-current="true"]');
    if (!nav || !current) return;

    const navRect = nav.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : 'smooth';

    if (window.matchMedia('(max-width: 767px)').matches) {
      const left = nav.scrollLeft + currentRect.left - navRect.left - (nav.clientWidth - currentRect.width) / 2;
      nav.scrollTo({ left: Math.max(0, left), behavior });
      return;
    }

    const top = nav.scrollTop + currentRect.top - navRect.top - (nav.clientHeight - currentRect.height) / 2;
    nav.scrollTo({ top: Math.max(0, top), behavior });
  }, [activeIndex, items.length]);

  function goToQuestion(event, index) {
    event.preventDefault();
    const target = document.getElementById(`question-${index + 1}`);
    if (!target) return;
    const header = document.querySelector('.mb-app-header');
    const topOffset = window.matchMedia('(max-width: 767px)').matches && header
      ? header.getBoundingClientRect().height + 12
      : 16;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - topOffset);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    manualSelectionUntil.current = Date.now() + 800;
    setActiveIndex(index);
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    window.history.replaceState(window.history.state, '', `#question-${index + 1}`);
    target.focus({ preventScroll: true });

    const badge = target.querySelector('.q-number');
    window.setTimeout(() => {
      if (reduceMotion) return;
      target.classList.remove('is-anchor-trace');
      badge?.classList.remove('is-anchor-bounce');
      void target.offsetWidth;
      target.classList.add('is-anchor-trace');

      if (badge) {
        void badge.offsetWidth;
        badge.classList.add('is-anchor-bounce');
        badge.addEventListener('animationend', () => badge.classList.remove('is-anchor-bounce'), { once: true });
      }

      const clearTrace = event => {
        if (event.animationName !== 'mb-question-card-trace') return;
        target.classList.remove('is-anchor-trace');
        target.removeEventListener('animationend', clearTrace);
        target.removeEventListener('animationcancel', clearTrace);
      };
      target.addEventListener('animationend', clearTrace);
      target.addEventListener('animationcancel', clearTrace);
    }, reduceMotion ? 0 : 450);
  }

  return { activeIndex, goToQuestion, items, navRef };
}

export function AppHeader({ active, error, hideMobileTop = false, hideSolverBack = false, solverBack = null, mobileSubnav, onLogout, pending = false, profileSkeleton = false, user, variant = 'default' }) {
  const activeDockIndex = Math.max(0, ['papers', 'create', 'achievement', 'prd', 'account'].indexOf(active));
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('moonble:sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return sessionStorage.getItem('moonble:sidebar-hidden') === 'true'; }
    catch { return false; }
  });
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
  const [shareNotification, setShareNotification] = useState(null);
  const [shareNotifications, setShareNotifications] = useState([]);
  const [favoriteSidebarItems, setFavoriteSidebarItems] = useState(() => getFavoriteSidebarItems(user?.id));
  const [scrapSidebarItems, setScrapSidebarItems] = useState(() => getLocalScrapSidebarItems(user?.id));
  const [favoriteGroupsOpen, setFavoriteGroupsOpen] = useState({ paper: true, scrap: true, prd: true });
  const [favoriteSolvePaper, setFavoriteSolvePaper] = useState(null);
  const [favoritePreviewOpen, setFavoritePreviewOpen] = useState(false);
  useEffect(() => { if (!favoriteSolvePaper) setFavoritePreviewOpen(false); }, [favoriteSolvePaper]);
  const [solverPaper, setSolverPaper] = useState(() => window.moonbleSolverPaper || {
    title: document.querySelector('#quiz .section-head h2')?.textContent?.trim() || '',
  });
  const [solverMemos, setSolverMemos] = useState(() => readQuizMemos(window.moonbleSolverPaper || {}));
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [browserNotificationSettings, setBrowserNotificationSettings] = useState(() => getBrowserNotificationSettings(user?.id));
  const [browserNotificationBusy, setBrowserNotificationBusy] = useState(false);
  const [browserNotificationError, setBrowserNotificationError] = useState('');
  const [mobileDockIndex, setMobileDockIndex] = useState(() => {
    try {
      const saved = sessionStorage.getItem('moonble:mobile-dock-index');
      const previous = saved == null ? null : Number(saved);
      return Number.isInteger(previous) && previous >= 0 && previous < 5 ? previous : activeDockIndex;
    } catch { return activeDockIndex; }
  });
  const mobileDockRef = useRef(null);
  const notificationBackRef = useRef(null);
  const notificationReturnFocusRef = useRef(null);
  const favoriteSolveTriggerRef = useRef(null);
  const favoriteSolveConfirmRef = useRef(null);
  const shareNotificationTimer = useRef(0);
  const shareNotificationVisible = useRef(false);
  const profile = user ? profileOf(user) : null;
  const name = profile?.name || user?.email || '내 계정';
  const solver = variant === 'solver';
  const sharedSolver = solver && hideSolverBack;
  const [quizPenMode, setQuizPenMode] = useState(() => window.moonbleQuizPenMode === true);
  const questions = useSolverQuestions(solver);
  const solverHeading = '문제 목록';
  const favoriteGroups = [
    { type: 'paper', label: '문제지', items: favoriteSidebarItems.filter(item => item.type === 'paper') },
    { type: 'scrap', label: '스크랩', items: scrapSidebarItems },
    { type: 'prd', label: 'PRD', items: favoriteSidebarItems.filter(item => item.type === 'prd') },
  ].filter(group => group.items.length > 0);
  const openFavoriteGroupCount = favoriteGroups.filter(group => favoriteGroupsOpen[group.type]).length;

  useEffect(() => {
    if (!favoriteSolvePaper) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = event => {
      if (event.key === 'Escape') setFavoriteSolvePaper(null);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    favoriteSolveConfirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (favoriteSolveTriggerRef.current?.isConnected) favoriteSolveTriggerRef.current.focus();
    };
  }, [favoriteSolvePaper]);

  useEffect(() => {
    const nav = questions.navRef.current;
    if (!solver || !collapsed || !nav || !window.matchMedia('(min-width: 768px)').matches) return undefined;

    let frame = 0;
    const updateDepth = () => {
      frame = 0;
      const nodes = Array.from(nav.querySelectorAll('.mb-solver-question'));
      if (!nodes.length) return;

      const activeIndex = Math.min(questions.activeIndex, nodes.length - 1);
      const active = nodes[activeIndex];
      const step = nodes.length > 1 ? nodes[1].offsetTop - nodes[0].offsetTop : 44;
      const maxScrollTop = Math.max(0, nav.scrollHeight - nav.clientHeight);
      const activeCenter = active.offsetTop + active.offsetHeight / 2;
      const activeScrollTop = Math.max(0, Math.min(maxScrollTop, activeCenter - nav.clientHeight / 2));
      const focalIndex = activeIndex + (nav.scrollTop - activeScrollTop) / Math.max(1, step);

      nodes.forEach((node, index) => {
        const distance = Math.abs(index - focalIndex);
        // Keep every question number readable; only the circle scale and opacity
        // recede gently toward the edges of the collapsed navigator.
        const size = Math.max(26, 32 - Math.max(0, distance - 2.5) * 0.9);
        const fontSize = size >= 30 ? 12 : 10;
        const opacity = Math.max(0.88, 1 - distance * 0.018);
        const distanceBin = distance >= 8 ? 'far' : String(Math.round(distance));
        node.dataset.distance = distanceBin;
        node.style.setProperty('--mb-solver-number-size', `${size.toFixed(2)}px`);
        node.style.setProperty('--mb-solver-number-font-size', `${fontSize}px`);
        node.style.setProperty('--mb-solver-number-opacity', opacity.toFixed(2));
      });
    };
    const scheduleDepthUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateDepth);
    };

    nav.addEventListener('scroll', scheduleDepthUpdate, { passive: true });
    window.addEventListener('resize', scheduleDepthUpdate);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleDepthUpdate) : null;
    observer?.observe(nav);
    scheduleDepthUpdate();

    return () => {
      nav.removeEventListener('scroll', scheduleDepthUpdate);
      window.removeEventListener('resize', scheduleDepthUpdate);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      nav.querySelectorAll('.mb-solver-question').forEach(node => {
        node.style.removeProperty('--mb-solver-number-size');
        node.style.removeProperty('--mb-solver-number-font-size');
        node.style.removeProperty('--mb-solver-number-opacity');
      });
    };
  }, [collapsed, questions.activeIndex, questions.items.length, questions.navRef, solver]);

  useEffect(() => {
    if (!solver) return undefined;
    const syncHeading = event => {
      const detail = event?.detail;
      if (detail && typeof detail.title === 'string') {
        setSolverPaper(current => ({ ...current, ...detail }));
        return;
      }
      const title = document.querySelector('#quiz .section-head h2')?.textContent?.trim() || '';
      setSolverPaper(current => current.title === title ? current : { ...current, title });
    };
    const heading = document.querySelector('#quiz .section-head');
    const observer = heading ? new MutationObserver(syncHeading) : null;
    observer?.observe(heading, { childList: true, characterData: true, subtree: true });
    window.addEventListener('moonble:solve-paper-heading-change', syncHeading);
    syncHeading();
    return () => {
      observer?.disconnect();
      window.removeEventListener('moonble:solve-paper-heading-change', syncHeading);
    };
  }, [solver]);

  useEffect(() => {
    if (!solver) return undefined;
    const paperKey = quizMemoPaperKey(solverPaper);
    setSolverMemos(readQuizMemos(paperKey));
    const syncMemos = event => {
      if (event.detail?.paperKey !== paperKey || !Array.isArray(event.detail?.memos)) return;
      setSolverMemos(event.detail.memos);
    };
    window.addEventListener('moonble:quiz-memos-change', syncMemos);
    return () => window.removeEventListener('moonble:quiz-memos-change', syncMemos);
  }, [solver, solverPaper.paperId, solverPaper.bankId, solverPaper.shareId, solverPaper.title]);

  useEffect(() => {
    if (!solver) return undefined;
    const syncPenMode = event => {
      const active = Boolean(event.detail?.active);
      setQuizPenMode(active);
      if (active && window.matchMedia('(max-width: 767px)').matches) setMobileHeaderHidden(false);
    };
    window.addEventListener('moonble:quiz-pen-mode-change', syncPenMode);
    return () => window.removeEventListener('moonble:quiz-pen-mode-change', syncPenMode);
  }, [solver]);

  useEffect(() => {
    setShareNotifications(readShareNotifications(user?.id));
    setNotificationOpen(false);
    setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    let revision = 0;
    async function refreshScraps() {
      const request = ++revision;
      const localItems = getLocalScrapSidebarItems(user?.id);
      setScrapSidebarItems(current => current.length === localItems.length && current.every((item, index) => item.id === localItems[index]?.id && item.label === localItems[index]?.label) ? current : localItems);
      if (!user?.id || !supabase) return;
      try {
        const tokens = await getMyPublicQuizLikedTokens();
        const found = new Map();
        for (let offset = 0; offset < tokens.length; offset += PUBLIC_PAGE_SIZE) {
          const page = await listPublicQuizzes({ tokens: tokens.slice(offset, offset + PUBLIC_PAGE_SIZE), sort: 'latest' });
          page.items.forEach(item => found.set(item.token, item));
        }
        if (!alive || request !== revision) return;
        setScrapSidebarItems(tokens.map(token => {
          const item = found.get(token);
          if (!item) return null;
          return {
            id: `scrap:${token}`,
            type: 'scrap',
            label: item.title || '스크랩한 문제지',
            href: `./solve.html#share=${encodeURIComponent(token)}`,
            preview: () => getQuizShare(token).then(share => previewPaperFromQuestions(share)),
          };
        }).filter(Boolean));
      } catch {
        // DB 연결 전이거나 일시 오류일 때는 이 기기에 저장된 스크랩을 유지한다.
      }
    }
    const onLikeChange = event => {
      if (event.detail?.userId && event.detail.userId !== user?.id) return;
      refreshScraps();
    };
    refreshScraps();
    window.addEventListener('storage', onLikeChange);
    window.addEventListener('pageshow', onLikeChange);
    window.addEventListener('moonble:public-quiz-likes', onLikeChange);
    return () => {
      alive = false;
      window.removeEventListener('storage', onLikeChange);
      window.removeEventListener('pageshow', onLikeChange);
      window.removeEventListener('moonble:public-quiz-likes', onLikeChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('openNotifications') !== '1') return;
    setShareNotifications(current => markShareNotificationsSeen(user.id, current));
    setNotificationOpen(true);
    url.searchParams.delete('openNotifications');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [user?.id]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onServiceWorkerMessage = event => {
      if (event.data?.type !== 'moonble:open-notifications' || !user?.id) return;
      setShareNotifications(current => markShareNotificationsSeen(user.id, current));
      setNotificationOpen(true);
    };
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
  }, [user?.id]);

  useEffect(() => {
    const refresh = event => {
      if (event?.detail?.userId && event.detail.userId !== user?.id) return;
      setFavoriteSidebarItems(getFavoriteSidebarItems(user?.id));
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('moonble:paper-favorites', refresh);
    window.addEventListener('moonble:custom-bank-collection', refresh);
    window.addEventListener('moonble:prd-favorites', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('moonble:paper-favorites', refresh);
      window.removeEventListener('moonble:custom-bank-collection', refresh);
      window.removeEventListener('moonble:prd-favorites', refresh);
    };
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
    const onPreferenceChange = event => {
      if (!event.detail?.userId || event.detail.userId === user?.id) {
        refresh();
        setBrowserNotificationError('');
      }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;
    let alive = true;
    let checking = false;
    let interval = 0;

    async function checkSharedQuizNotifications() {
      if (!alive || checking || shareNotificationVisible.current || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const notification = await getNextQuizShareNotification();
        if (!alive || !notification?.id) return;
        setShareNotifications(rememberShareNotification(user.id, notification));
        shareNotificationVisible.current = true;
        setShareNotification(notification);
        window.clearTimeout(shareNotificationTimer.current);
        shareNotificationTimer.current = window.setTimeout(() => {
          shareNotificationVisible.current = false;
          setShareNotification(null);
          checkSharedQuizNotifications();
        }, 3200);
      } catch {
        // DB 마이그레이션 전이거나 네트워크가 끊겨도 나머지 화면 사용은 계속한다.
      } finally {
        checking = false;
      }
    }

    const resume = () => { if (document.visibilityState === 'visible') checkSharedQuizNotifications(); };
    checkSharedQuizNotifications();
    interval = window.setInterval(checkSharedQuizNotifications, 18000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearTimeout(shareNotificationTimer.current);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      shareNotificationVisible.current = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!notificationOpen) return undefined;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    notificationBackRef.current?.focus({ preventScroll: true });
    function closeOnEscape(event) {
      if (event.key === 'Escape') setNotificationOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      notificationReturnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [notificationOpen]);

  function openNotifications(event) {
    notificationReturnFocusRef.current = event.currentTarget;
    if (user?.id) setShareNotifications(current => markShareNotificationsSeen(user.id, current));
    setNotificationOpen(true);
  }

  function closeNotifications() {
    setNotificationOpen(false);
  }

  async function enableBrowserNotifications() {
    if (browserNotificationBusy) return;
    setBrowserNotificationBusy(true);
    setBrowserNotificationError('');
    try {
      const settings = await requestBrowserNotifications(user?.id);
      setBrowserNotificationSettings(settings);
      if (settings.permission === 'denied') {
        setBrowserNotificationError('알림이 차단돼 있어요. 브라우저 사이트 설정에서 알림을 허용해주세요.');
      } else if (settings.permission === 'install-required') {
        setBrowserNotificationError('iPhone·iPad에서는 문블을 홈 화면에 추가한 뒤 앱에서 알림을 켤 수 있어요.');
      } else if (settings.permission === 'unconfigured') {
        setBrowserNotificationError('푸시 알림 서버 설정을 준비하고 있어요.');
      } else if (!settings.enabled && settings.permission !== 'unsupported' && settings.permission !== 'insecure') {
        setBrowserNotificationError('알림 권한을 허용한 뒤 다시 켜주세요.');
      }
    } catch {
      setBrowserNotificationError('알림 권한을 요청하지 못했어요. 브라우저 설정을 확인해주세요.');
      setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
    } finally {
      setBrowserNotificationBusy(false);
    }
  }

  useLayoutEffect(() => {
    const nav = mobileDockRef.current;
    if (!nav) return undefined;
    const setPosition = index => {
      const link = nav.querySelectorAll('a')[index];
      if (!link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      nav.style.setProperty('--mb-dock-x', `${linkRect.left + linkRect.width / 2 - navRect.left}px`);
    };
    setPosition(mobileDockIndex);
    const shouldAnimate = mobileDockIndex !== activeDockIndex;
    let transitionPending = shouldAnimate;
    let firstFrame = 0;
    let secondFrame = 0;
    if (shouldAnimate) {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          setPosition(activeDockIndex);
          setMobileDockIndex(activeDockIndex);
          transitionPending = false;
        });
      });
    } else {
      setMobileDockIndex(activeDockIndex);
    }
    try { sessionStorage.setItem('moonble:mobile-dock-index', String(activeDockIndex)); } catch { /* 메뉴 이동 효과 없이도 탐색은 계속 동작한다. */ }
    const updateForViewport = () => setPosition(activeDockIndex);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!transitionPending) updateForViewport(); }) : null;
    observer?.observe(nav);
    window.addEventListener('resize', updateForViewport);
    window.visualViewport?.addEventListener('resize', updateForViewport);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
      window.removeEventListener('resize', updateForViewport);
      window.visualViewport?.removeEventListener('resize', updateForViewport);
    };
  }, [activeDockIndex]);

  useEffect(() => {
    document.body.classList.add('mb-has-app-sidebar');
    document.body.classList.toggle('mb-has-app-dock', !solver);
    return () => {
      document.body.classList.remove('mb-has-app-sidebar');
      document.body.classList.remove('mb-has-app-dock');
    };
  }, [solver]);

  useEffect(() => {
    document.body.classList.toggle('mb-sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('mb-sidebar-collapsed');
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem('moonble:sidebar-collapsed', String(collapsed)); } catch { /* 저장할 수 없어도 토글은 동작한다. */ }
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle('mb-sidebar-hidden', sidebarHidden);
    try { sessionStorage.setItem('moonble:sidebar-hidden', String(sidebarHidden)); } catch { /* 현재 탭에 저장할 수 없어도 단축키는 동작한다. */ }
    return () => document.body.classList.remove('mb-sidebar-hidden');
  }, [sidebarHidden]);

  useEffect(() => {
    function toggleSidebar(event) {
      if (!event.shiftKey || event.code !== 'Backslash' || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      setSidebarHidden(value => !value);
    }

    window.addEventListener('keydown', toggleSidebar);
    return () => window.removeEventListener('keydown', toggleSidebar);
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    let direction = 0;
    let distance = 0;
    let frame = 0;
    let touchStartY = null;

    function updateHeader() {
      frame = 0;
      if (!window.matchMedia('(max-width: 767px)').matches) {
        setMobileHeaderHidden(false);
        previousY = window.scrollY;
        return;
      }

      const currentY = Math.max(0, window.scrollY);
      if (solver) {
        setMobileHeaderHidden(false);
        direction = 0;
        distance = 0;
        previousY = currentY;
        return;
      }
      const delta = currentY - previousY;
      const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : 0;

      if (currentY < 24) {
        setMobileHeaderHidden(false);
        direction = 0;
        distance = 0;
      } else if (nextDirection) {
        if (nextDirection !== direction) {
          direction = nextDirection;
          distance = 0;
        }
        distance += Math.abs(delta);
        // 모바일 헤더는 스크롤 중에도 고정한다(디자인 가이드). 숨김 상태를 바꾸면 헤더 전체가 다시 그려져 탭이 흔들려 보이므로 바꾸지 않는다.
        if (distance >= (solver ? 8 : 18)) {
          setMobileHeaderHidden(false);
          distance = 0;
        }
      }
      previousY = currentY;
    }

    function scheduleHeader() {
      if (frame) return;
      frame = requestAnimationFrame(updateHeader);
    }

    function revealOnUpwardTouch(event) {
      if (!solver || !window.matchMedia('(max-width: 767px)').matches) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (touchStartY === null) touchStartY = touch.clientY;
      if (touch.clientY - touchStartY < 8) return;
      setMobileHeaderHidden(false);
      direction = -1;
      distance = 0;
      previousY = Math.max(0, window.scrollY);
    }

    function startTouch(event) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function endTouch() {
      touchStartY = null;
    }

    function revealOnUpwardWheel(event) {
      if (!solver || event.deltaY >= 0 || !window.matchMedia('(max-width: 767px)').matches) return;
      setMobileHeaderHidden(false);
      direction = -1;
      distance = 0;
      previousY = Math.max(0, window.scrollY);
    }

    window.addEventListener('scroll', scheduleHeader, { passive: true });
    window.addEventListener('resize', scheduleHeader);
    if (solver) {
      window.addEventListener('touchstart', startTouch, { passive: true });
      window.addEventListener('touchmove', revealOnUpwardTouch, { passive: true });
      window.addEventListener('touchend', endTouch, { passive: true });
      window.addEventListener('touchcancel', endTouch, { passive: true });
      window.addEventListener('wheel', revealOnUpwardWheel, { passive: true });
    }
    return () => {
      window.removeEventListener('scroll', scheduleHeader);
      window.removeEventListener('resize', scheduleHeader);
      if (solver) {
        window.removeEventListener('touchstart', startTouch);
        window.removeEventListener('touchmove', revealOnUpwardTouch);
        window.removeEventListener('touchend', endTouch);
        window.removeEventListener('touchcancel', endTouch);
        window.removeEventListener('wheel', revealOnUpwardWheel);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, [solver]);

  return <>
  <aside hidden={sidebarHidden} className={`mb-app-header${solver ? ' mb-solver-sidebar' : ''}${mobileSubnav && !solver ? ' has-mobile-subnav' : ''}${hideMobileTop && !solver ? ' is-mobile-top-hidden' : ''}${quizPenMode ? ' is-pen-actions-open' : ''}${sharedSolver ? ' is-shared-solver' : ''}${collapsed ? ' is-collapsed' : ''}${mobileHeaderHidden ? ' is-mobile-hidden' : ''} no-print`} aria-label={solver ? '문제풀이 탐색' : 'Moonble 워크스페이스'}>
    <div className="mb-app-header-inner">
      <div className="mb-app-brand-row">
        <a className="mb-app-logo" href="./quiz.html" aria-label="Moonble 홈"><BrandLogo decorative />{user && <UserAvatar user={user} className="mb-app-logo-avatar" />}</a>
        {user && <a className="mb-app-logo-my" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label="MY 메뉴 열기" title="MY" />}
        {user && <button className="mb-notification-toggle mb-notification-toggle--desktop" type="button" aria-label={`알림 ${shareNotifications.filter(item => !item.seen).length}개`} aria-expanded={notificationOpen} aria-controls="mb-notification-screen" onClick={openNotifications}>
          <Bell size={16} aria-hidden="true" />
          {shareNotifications.some(item => !item.seen) && <span className="mb-notification-badge" aria-label={`${shareNotifications.filter(item => !item.seen).length}개 안 읽은 알림`}>{Math.min(99, shareNotifications.filter(item => !item.seen).length)}</span>}
        </button>}
      </div>
      {!user && profileSkeleton && <div className="mb-app-profile-row mb-app-profile-skeleton" aria-hidden="true">
        <span className="mb-profile-skeleton-avatar" />
        <span className="mb-profile-skeleton-copy"><i /><i /></span>
        <span className="mb-profile-skeleton-settings" />
        <span className="mb-profile-skeleton-notification" />
      </div>}
      {user && <div className="mb-app-profile-row">
        <a className="mb-mobile-avatar-link" href="./account.html" aria-label={`${name} 계정 열기`}>
          <UserAvatar user={user} className="mb-mobile-profile-avatar" />
        </a>
        <button className="mb-notification-toggle mb-notification-toggle--mobile" type="button" aria-label={`알림 ${shareNotifications.filter(item => !item.seen).length}개`} aria-expanded={notificationOpen} aria-controls="mb-notification-screen" onClick={openNotifications}>
          <Bell size={19} aria-hidden="true" />
          {shareNotifications.some(item => !item.seen) && <span className="mb-notification-badge" aria-label={`${shareNotifications.filter(item => !item.seen).length}개 안 읽은 알림`}>{Math.min(99, shareNotifications.filter(item => !item.seen).length)}</span>}
        </button>
        <a className="mb-app-profile" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label={`${name} 계정 열기`}>
          <UserAvatar user={user} className="mb-app-profile-avatar" />
          <span className="mb-app-profile-copy"><strong>{name}</strong><small>{profile?.companyName || '개인 워크스페이스'}</small></span>
          <Settings2 size={16} aria-hidden="true" />
        </a>
      </div>}
      {!solver && mobileSubnav && <div className="mb-mobile-subnav">{mobileSubnav}</div>}
      {solver ? <nav className={`mb-app-nav mb-solver-nav${solverMemos.length ? ' has-memos' : ''}`} aria-label="문제 목록">
        <div className="mb-solver-heading">
          {!hideSolverBack && <a href={solverBack?.href || './quiz.html#paper-library'} onClick={solverBack?.onClick} aria-label={solverBack?.ariaLabel}><ChevronLeft size={18} aria-hidden="true" /><span>{solverBack?.label || '문제지'}</span></a>}
          {sharedSolver && <BrandLogo className="mb-solver-shared-logo" />}
          {solverPaper.title && <div className="mb-solver-paper" title={solverPaper.title}>
            <span className="mb-favorite-icon mb-solver-paper-icon"><BookOpen size={14} aria-hidden="true" /></span>
            <span className="mb-solver-paper-title">{solverPaper.title}</span>
          </div>}
        </div>
        <div className="mb-solver-question-list" role="group" aria-labelledby="mb-solver-list-heading">
          <strong id="mb-solver-list-heading">{solverHeading}</strong>
          <div className="mb-solver-questions" ref={questions.navRef}>
          {questions.items.map((item, index) => {
            const distance = Math.abs(index - questions.activeIndex);
            return (
              <a
                className={`mb-solver-question is-${item.status}`}
                data-distance={distance >= 8 ? 'far' : Math.round(distance)}
                href={`#${item.id}`}
                key={item.id}
                aria-current={questions.activeIndex === index ? 'true' : undefined}
                aria-label={`${index + 1}번 문제${item.status === 'answered' ? ', 답변 선택됨' : item.status === 'correct' ? ', 정답' : item.status === 'wrong' ? ', 오답' : ''}`}
                onClick={event => questions.goToQuestion(event, index)}
              >
                <span className="mb-solver-number">{index + 1}</span>
                <span className="mb-solver-label">{item.label}</span>
                <span className="mb-solver-status" aria-hidden="true">{item.status === 'correct' ? 'O' : item.status === 'wrong' ? 'X' : ''}</span>
              </a>
            );
          })}
          </div>
        </div>
        {solverMemos.length > 0 && <div className="mb-solver-memos" role="group" aria-label="문항 목록 아래 손글씨 메모">
          {solverMemos.map((memo, index) => <article className="mb-solver-memo" key={memo.id}>
            {memo.imageData
              ? <img src={memo.imageData} alt={`손글씨 메모 ${index + 1}`} />
              : <p>{memo.text}</p>}
            <button type="button" aria-label="메모 제거" title="메모 제거" onClick={() => removeQuizMemo(solverPaper, memo.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12" /></svg>
            </button>
          </article>)}
        </div>}
      </nav> : <nav className="mb-app-nav" aria-label="주 메뉴" ref={mobileDockRef}>
          <a href="./quiz.html#paper-library" aria-current={active === 'papers' ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" /><span>문제지</span></a>
          <a href="./quiz.html#create" aria-current={active === 'create' ? 'page' : undefined}><Sparkles size={18} aria-hidden="true" /><span>문제 생성하기</span></a>
          <a href="./quiz.html#achievement" aria-current={active === 'achievement' ? 'page' : undefined}><BarChart3 size={18} aria-hidden="true" /><span>나의 성취도</span></a>
          <a href="./prd.html" aria-current={active === 'prd' ? 'page' : undefined}><FileText size={18} aria-hidden="true" /><span>워크스페이스</span></a>
          <a className="mb-app-my" href="./account.html" aria-current={active === 'account' ? 'page' : undefined}><UserRound size={18} aria-hidden="true" /><span>MY</span></a>
        </nav>}
      {!solver && user && (favoriteSidebarItems.length > 0 || scrapSidebarItems.length > 0) && <section className="mb-favorites" aria-labelledby="mb-favorites-heading">
        <h2 className="mb-favorites-heading" id="mb-favorites-heading">즐겨찾기</h2>
        <nav className={`mb-favorites-list${openFavoriteGroupCount > 1 ? ' has-multiple-open-groups' : ''}`} aria-label="즐겨찾기">
          {favoriteGroups.map(group => <div className={`mb-favorite-group${favoriteGroupsOpen[group.type] ? '' : ' is-collapsed'}`} key={group.type}>
            <h3 className="mb-favorite-group-heading" id={`mb-favorite-${group.type}-heading`}>
              <button className="mb-favorite-group-toggle" type="button" aria-label={`${group.label} 즐겨찾기 ${favoriteGroupsOpen[group.type] ? '접기' : '펼치기'}`} aria-expanded={favoriteGroupsOpen[group.type]} aria-controls={`mb-favorite-${group.type}-items`} onClick={() => setFavoriteGroupsOpen(current => ({ ...current, [group.type]: !current[group.type] }))}>
                <ChevronDown size={14} aria-hidden="true" />
                <span>{group.label}</span>
              </button>
            </h3>
            <div className="mb-favorite-group-items" id={`mb-favorite-${group.type}-items`} role="group" aria-labelledby={`mb-favorite-${group.type}-heading`} tabIndex={favoriteGroupsOpen[group.type] ? 0 : undefined} hidden={!favoriteGroupsOpen[group.type]}>
              {group.items.map(paper => <a className={`mb-favorite-link${paper.type === 'prd' ? ' is-prd' : ''}`} href={paper.href} key={paper.id} title={paper.label} onClick={event => {
                if (paper.type !== 'paper' && paper.type !== 'scrap') return;
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                favoriteSolveTriggerRef.current = event.currentTarget;
                setFavoriteSolvePaper(paper);
              }}>
                <span className="mb-favorite-icon">{paper.type === 'prd' ? <FileText size={14} aria-hidden="true" /> : <BookOpen size={14} aria-hidden="true" />}</span>
                <span className="mb-favorite-copy">
                  <span className="mb-favorite-title">{paper.label}</span>
                  {paper.type === 'paper' && paper.caption && <span className="mb-favorite-caption">{paper.caption}</span>}
                </span>
              </a>)}
            </div>
          </div>)}
        </nav>
      </section>}
      {(user || onLogout || error) && <div className="mb-app-account">
        {error && <p className="mb-app-error" role="alert">{error}</p>}
        {onLogout && <button className="mb-app-logout" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : '로그아웃'} onClick={onLogout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={17} aria-hidden="true" /><span>로그아웃</span></>}
        </button>}
      </div>}
    </div>
    <div className="mb-sidebar-tools">
      {solver && <button className={`mb-pen-mode-toggle${quizPenMode ? ' is-active' : ''}`} type="button" aria-pressed={quizPenMode} aria-label={quizPenMode ? '펜 모드 끄기' : '펜 모드 켜기'} title={quizPenMode ? '펜 모드 끄기' : '펜 모드 켜기'} onClick={() => window.dispatchEvent(new CustomEvent('moonble:toggle-quiz-pen-mode'))}>
        <PenLine size={16} aria-hidden="true" />
        <span aria-hidden="true">펜 모드</span>
      </button>}
      <button className="mb-sidebar-toggle" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} onClick={() => setCollapsed(value => !value)}>
        {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        {!collapsed && <span aria-hidden="true">접기</span>}
      </button>
    </div>
  </aside>
  {favoriteSolvePaper && <div className="mb-favorite-solve-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFavoriteSolvePaper(null); }}>
    <section className="mb-favorite-solve-dialog" role="dialog" aria-modal="true" aria-labelledby="mb-favorite-solve-title" aria-describedby="mb-favorite-solve-copy">
      <h2 id="mb-favorite-solve-title">이 문제를 푸시겠어요?</h2>
      <p id="mb-favorite-solve-copy">{favoriteSolvePaper.label}</p>
      <footer>
        <button type="button" className="mb-favorite-solve-cancel" onClick={() => setFavoriteSolvePaper(null)}>취소</button>
        <a ref={favoriteSolveConfirmRef} className="mb-favorite-solve-confirm" href={favoriteSolvePaper.href}>풀어보기</a>
      </footer>
      {favoriteSolvePaper.preview && <p className="mb-preview-caption"><span>어떤 문제인지 궁금하신가요?</span><button type="button" onClick={() => setFavoritePreviewOpen(true)}>미리보기</button></p>}
    </section>
  </div>}
  {user?.id && <StudyReminders userId={user.id} />}
  {favoriteSolvePaper?.preview && favoritePreviewOpen && <QuizPreviewDialog solveHref={favoriteSolvePaper.href} load={favoriteSolvePaper.preview} onClose={() => setFavoritePreviewOpen(false)} />}
  {notificationOpen && <section className="mb-notification-screen" id="mb-notification-screen" role="dialog" aria-modal="true" aria-labelledby="mb-notification-title">
    <div className="mb-notification-screen-nav">
      <button ref={notificationBackRef} type="button" aria-label="알림 닫기" onClick={closeNotifications}><ChevronLeft size={24} aria-hidden="true" /></button>
    </div>
    <main className="mb-notification-screen-main">
      <header className="mb-notification-screen-heading"><h1 id="mb-notification-title">알림</h1></header>
      {!browserNotificationSettings.enabled && (() => {
        const permission = browserNotificationSettings.permission;
        const disabled = browserNotificationBusy || ['denied', 'unsupported', 'insecure', 'install-required', 'unconfigured'].includes(permission);
        const description = permission === 'unsupported'
          ? '현재 환경에서는 푸시 알림을 사용할 수 없어요. 아래 알림 기록에서 공유 문제 풀이 결과를 확인해주세요.'
          : permission === 'insecure'
            ? '보안 연결에서 접속하면 푸시 알림을 켤 수 있어요.'
            : permission === 'denied'
              ? '브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해주세요.'
              : permission === 'install-required'
                ? 'iPhone·iPad에서는 문블을 홈 화면에 추가한 뒤 앱에서 알림을 켤 수 있어요.'
                : permission === 'unconfigured'
                  ? '푸시 알림 서버 설정을 준비하고 있어요.'
                  : '공유한 문제를 누군가 풀면 푸시 알림으로 알려드려요.';
        return <section className="mb-browser-alert-card" aria-label="푸시 알림 설정">
          <div className="mb-browser-alert-head"><h2>푸시 알림</h2><span className="mb-browser-alert-status">꺼짐</span></div>
          <p className="mb-browser-alert-copy">{description}</p>
          {browserNotificationError && <p className="mb-browser-alert-error" role="status">{browserNotificationError}</p>}
          <div className="mb-browser-alert-actions">
            <button type="button" className="is-primary" disabled={disabled} onClick={enableBrowserNotifications}>{browserNotificationBusy ? '알림 권한 요청 중' : permission === 'denied' ? '브라우저 설정에서 허용' : permission === 'unsupported' ? '알림 사용 불가' : permission === 'insecure' ? '보안 연결 필요' : permission === 'install-required' ? '홈 화면 앱에서 설정' : permission === 'unconfigured' ? '설정 준비 중' : '푸시 알림 켜기'}</button>
          </div>
        </section>;
      })()}
      {shareNotifications.length ? <div className="mb-notification-screen-list">
        {shareNotifications.map(item => <article className="mb-notification-screen-item" key={item.id}>
          <div className="mb-notification-item-heading">
            <span className="mb-notification-title"><span className="mb-notification-paper-title">{item.title}</span>{!item.seen && <i className="mb-notification-unread" aria-label="안 읽음" />}</span>
            <time className="mb-notification-meta" dateTime={item.created_at}>{formatRelativeDate(item.created_at)}</time>
          </div>
          <span className="mb-notification-copy">공유한 문제를 누군가 풀었어요.</span>
          <span className="mb-notification-copy">{item.score}점 ({item.correct}/{item.total})</span>
        </article>)}
      </div> : <div className="mb-notification-empty">
        <Bell size={30} aria-hidden="true" />
        <strong>아직 받은 알림이 없어요</strong>
        <p>문제지를 공유하면 풀이 결과를 여기서 확인할 수 있어요.</p>
      </div>}
    </main>
  </section>}
  {shareNotification && <div className={`mb-share-notification-toast${solver ? ' is-solver' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <strong>공유한 문제를 누군가 풀었어요.</strong>
    <span>{shareNotification.title} · {shareNotification.score}점 ({shareNotification.correct}/{shareNotification.total})</span>
  </div>}
  </>;
}
