// 풀이 화면 보조(보호된 풀이 스크립트는 건드리지 않고 바깥에서 붙인다)
// 1) 풀이 기록을 올릴 때 틀린 문제에 고른 답과, 일지에서 시작한 재풀이면 원본 회차(retry_of)를 함께 남긴다.
// 2) 일지의 '틀린 문제 보기'(?paper=retry&review=1): 틀린 문제를 고른 답·정답·해설과 함께 보여주고(기록 저장 없음),
//    '틀린 문제 다시 풀기'로 같은 문제를 정답을 가린 채 새 회차로 푼다(원본 기록은 그대로).
import { saveAchievementAttempt } from './achievement-history.js';
import './solve-review.css';

const params = new URLSearchParams(window.location.search);
const isRetry = params.get('paper') === 'retry';
const isReview = isRetry && params.get('review') === '1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readMeta() {
  try { return JSON.parse(sessionStorage.getItem('moonble:retry-meta') || '{}') || {}; } catch { return {}; }
}
function safeReturnUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return url.origin === window.location.origin ? url.href : '';
  } catch { return ''; }
}

// 채점 직후 화면에서 틀린 문항의 고른 보기를 읽는다.
function collectWrongAnswers() {
  const answers = {};
  document.querySelectorAll('#quizContainer .q-card').forEach(card => {
    if (!card.querySelector('.q-number.wrong') || !/^\d+$/.test(card.dataset.qid || '')) return;
    answers[card.dataset.qid] = [...card.querySelectorAll('.option-card')].map((option, index) => (option.classList.contains('selected') ? index : null)).filter(index => index !== null);
  });
  return answers;
}

window.moonbleAchievementHistory = {
  save(userId, record) {
    const next = { ...record, wrongAnswers: collectWrongAnswers() };
    const meta = isRetry && !isReview ? readMeta() : {};
    if (UUID_PATTERN.test(String(meta.attemptId || ''))) next.retryOf = meta.attemptId;
    return saveAchievementAttempt(userId, next);
  },
};

function addReturnLink(meta, container) {
  const href = safeReturnUrl(meta.returnUrl);
  if (!href) return;
  const link = document.createElement('a');
  link.className = 'solve-review-return';
  link.href = href;
  link.textContent = '일지로 돌아가기';
  container.appendChild(link);
}

function applyReview() {
  const meta = readMeta();
  const container = document.getElementById('quizContainer');
  const recorded = meta.wrongAnswers && typeof meta.wrongAnswers === 'object' ? meta.wrongAnswers : null;
  // 보기를 눌러 답이 바뀌지 않게 막는다(보호된 스크립트의 클릭 처리보다 먼저 가로챈다).
  container.addEventListener('click', event => { if (event.target.closest('.option-card')) { event.preventDefault(); event.stopPropagation(); } }, true);
  container.addEventListener('keydown', event => { if (event.target.closest('.option-card')) { event.preventDefault(); event.stopPropagation(); } }, true);

  const notice = document.createElement('div');
  notice.className = 'solve-review-notice';
  const title = document.createElement('strong');
  const copy = document.createElement('p');
  copy.textContent = recorded ? '그때 고른 답과 정답·해설을 함께 보여드려요.' : '이 풀이는 고른 답이 기록되지 않아 정답과 해설만 보여드려요.';
  notice.append(title, copy);
  container.before(notice);
  const actions = document.createElement('div');
  actions.className = 'solve-review-actions';
  const retry = document.createElement('a');
  retry.className = 'mb-action mb-action--primary';
  retry.href = './solve.html?paper=retry#quiz';
  retry.textContent = '틀린 문제 다시 풀기';
  actions.appendChild(retry);
  addReturnLink(meta, actions);
  document.querySelector('.quiz-actions')?.after(actions);

  // 풀이 화면이 문제를 다시 그려도(로그인 확인·문제지 동기화 뒤) 표시를 다시 입힌다.
  const paint = () => {
    const bank = typeof window.getActiveBank === 'function' ? (window.getActiveBank() || []) : [];
    const cards = [...container.querySelectorAll('.q-card')];
    title.textContent = `틀린 문제 ${cards.length}개`;
    container.classList.add('quiz-locked');
    cards.forEach(card => {
      const question = bank.find(item => String(item.id) === card.dataset.qid);
      if (!question) return;
      const chosen = recorded && Array.isArray(recorded[card.dataset.qid]) ? recorded[card.dataset.qid] : null;
      card.querySelectorAll('.option-card').forEach((option, index) => {
        const picked = Boolean(chosen?.includes(index));
        const correct = question.correct.includes(index);
        option.classList.toggle('selected', picked);
        option.classList.toggle('correct', correct);
        option.classList.toggle('incorrect', picked && !correct);
        option.setAttribute('aria-checked', picked ? 'true' : 'false');
        option.setAttribute('aria-disabled', 'true');
        option.setAttribute('tabindex', '-1');
        const input = option.querySelector('input');
        if (input) { input.checked = picked; input.disabled = true; }
      });
      const badge = card.querySelector('.q-number');
      if (badge && !badge.classList.contains('wrong')) { badge.classList.remove('right'); badge.classList.add('wrong'); }
      const explain = document.getElementById(`exp-${question.id}`);
      if (explain) {
        explain.replaceChildren();
        const line = (label, text) => { const strong = document.createElement('b'); strong.textContent = label; explain.append(strong, `: ${text}`); };
        if (chosen) { line('내가 고른 답', chosen.length ? chosen.map(index => question.options[index]).join(', ') : '고르지 않음'); explain.append(document.createElement('br')); }
        line('정답', question.correct.map(index => question.options[index]).join(', '));
        explain.append(document.createElement('br'));
        line('해설', question.explain || '—');
        explain.style.display = 'block';
      }
    });
  };
  paint();
  let frame = 0;
  new MutationObserver(() => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(paint); }).observe(container, { childList: true });
}

function whenQuizReady(callback) {
  const ready = () => !document.documentElement.hasAttribute('data-auth-pending') && document.querySelector('#quizContainer .q-card');
  if (ready()) { callback(); return; }
  const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); callback(); } });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-auth-pending'], childList: true, subtree: true });
}

if (isReview) {
  document.documentElement.classList.add('is-wrong-review');
  whenQuizReady(applyReview);
} else if (isRetry) {
  // 일지에서 시작한 재풀이: 돌아갈 길을 남겨 둔다(정답은 제출 뒤에만 보인다).
  whenQuizReady(() => {
    const meta = readMeta();
    if (!safeReturnUrl(meta.returnUrl)) return;
    const actions = document.createElement('div');
    actions.className = 'solve-review-actions is-retry';
    addReturnLink(meta, actions);
    document.querySelector('.quiz-actions')?.after(actions);
  });
}
