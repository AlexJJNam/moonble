/**
 * ChatGPT 앱용 iframe 위젯 스크립트
 *
 * 구조:
 *  1. 상태 관리 (loading / data / empty / error)
 *  2. mock 데이터 정의
 *  3. UI 렌더 함수
 *  4. ChatGPT 호스트 브리지 (postMessage 수신)
 *  5. 초기화
 */

/* ===================================================
   1. 상태 관리
   - currentState: 현재 화면 상태
   - setState()  : 상태 변경 + 화면 전환
   =================================================== */

// 가능한 상태값: 'loading' | 'data' | 'empty' | 'error'
let currentState = 'loading';

/**
 * 상태를 바꾸고 화면을 전환한다.
 * widget.html의 .widget-root[data-view] 속성을 변경해
 * CSS가 맞는 섹션만 보이도록 한다.
 */
function setState(newState) {
  currentState = newState;
  const root = document.querySelector('.widget-root');
  if (root) root.setAttribute('data-view', newState);
}

/* ===================================================
   2. Mock 데이터
   - 실제 ChatGPT 호스트에서 데이터가 오기 전,
     또는 로컬 미리보기 시 이 데이터를 사용한다.
   =================================================== */

const MOCK_DATA = {
  // 헤더 요약 카드
  header: {
    title: '이번 달 판매 요약',
    subtitle: '2026년 4월 1일 ~ 10일 기준',
    badge: '실시간 업데이트',
  },

  // 지표 카드 3개
  metrics: [
    {
      label: '총 매출',
      value: '₩24,380,000',
      change: '+12.4%',
      direction: 'up',     // 'up' | 'down' | 'flat'
    },
    {
      label: '신규 주문',
      value: '1,847',
      change: '-3.1%',
      direction: 'down',
    },
    {
      label: '평균 객단가',
      value: '₩13,200',
      change: '0.0%',
      direction: 'flat',
    },
  ],

  // 상세 리스트
  items: [
    { icon: '👟', name: '런닝화 X Pro', desc: '스포츠 > 신발', value: '₩8,200,000' },
    { icon: '🎧', name: '무선 이어폰 Pro Max', desc: '전자기기 > 음향', value: '₩6,540,000' },
    { icon: '🧴', name: '수분 크림 울트라 딥 모이스처라이징', desc: '뷰티 > 스킨케어', value: '₩3,880,000' },
    { icon: '📦', name: '멀티 수납 박스 세트', desc: '생활용품 > 수납', value: '₩2,760,000' },
    { icon: '☕', name: '드립 커피 모음전', desc: '식품 > 음료', value: '₩1,200,000' },
  ],
};

/* ===================================================
   3. UI 렌더 함수
   =================================================== */

/**
 * mock 데이터(또는 실제 수신 데이터)를 받아 화면에 그린다.
 * @param {object} data - MOCK_DATA와 같은 구조
 */
function renderData(data) {
  // 헤더 카드
  document.getElementById('header-title').textContent    = data.header.title;
  document.getElementById('header-subtitle').textContent = data.header.subtitle;
  document.getElementById('header-badge').textContent    = data.header.badge;

  // 지표 카드 3개
  const metricsEl = document.getElementById('metrics-grid');
  metricsEl.innerHTML = data.metrics.map((m) => `
    <div class="metric-card">
      <span class="metric-card__label">${escapeHtml(m.label)}</span>
      <span class="metric-card__value">${escapeHtml(m.value)}</span>
      <span class="metric-card__change metric-card__change--${m.direction}">
        ${m.direction === 'up' ? '▲' : m.direction === 'down' ? '▼' : '–'}
        ${escapeHtml(m.change)}
      </span>
    </div>
  `).join('');

  // 상세 리스트
  const listEl = document.getElementById('detail-list');
  if (data.items.length === 0) {
    // 아이템이 없으면 빈 상태로 전환
    setState('empty');
    return;
  }
  listEl.innerHTML = data.items.map((item) => `
    <div class="list-item">
      <div class="list-item__left">
        <div class="list-item__icon" aria-hidden="true">${item.icon}</div>
        <div class="list-item__text">
          <div class="list-item__name">${escapeHtml(item.name)}</div>
          <div class="list-item__desc">${escapeHtml(item.desc)}</div>
        </div>
      </div>
      <div class="list-item__value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  // 데이터 뷰 표시
  setState('data');
}

/**
 * XSS 방지: 사용자 데이터를 HTML에 넣기 전 특수문자를 이스케이프한다.
 * (외부 데이터를 innerHTML에 직접 쓰면 XSS 취약점이 생기므로 필수)
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

/* ===================================================
   4. ChatGPT 호스트 브리지 (postMessage)
   - ChatGPT 호스트가 ui/* 메시지를 보내면 여기서 받는다.
   - 실제 연동 전까지는 mock 데이터를 사용한다.
   =================================================== */

/**
 * 호스트(ChatGPT)에서 오는 메시지를 처리한다.
 * 메시지 형식: { method: 'ui/notifications/tool-result', params: { ... } }
 */
window.addEventListener('message', (event) => {
  // 보안: 신뢰할 수 있는 출처만 처리한다.
  // 실제 배포 시 'https://chatgpt.com'으로 제한해야 한다.
  // if (event.origin !== 'https://chatgpt.com') return;

  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  const method = msg.method || '';

  if (method === 'ui/notifications/tool-result') {
    // 호스트가 툴 결과를 보냈을 때 → 실제 데이터로 렌더
    const payload = msg.params?.result;
    if (payload) {
      renderData(payload);
    }
  } else if (method === 'ui/notifications/tool-input') {
    // 툴 호출이 시작됐을 때 → 로딩 상태 표시
    setState('loading');
  } else if (method === 'ui/error') {
    // 호스트가 에러를 알릴 때
    showError(msg.params?.message || '알 수 없는 오류가 발생했습니다.');
  }
});

/**
 * 호스트에 메시지를 보낸다 (예: 버튼 클릭 이벤트).
 * @param {string} method - 메시지 메서드명
 * @param {object} params - 전달할 파라미터
 */
function postToHost(method, params) {
  // iframe 안에서 부모 window로 메시지를 보낸다.
  // 실제 배포 시 targetOrigin을 'https://chatgpt.com'으로 설정해야 한다.
  const targetOrigin = (window.parent !== window) ? '*' : window.location.origin;
  window.parent.postMessage({ method, params }, targetOrigin);
}

/* ===================================================
   5. 에러 표시 & 재시도
   =================================================== */

/**
 * 에러 메시지를 화면에 표시한다.
 * @param {string} message - 표시할 에러 메시지
 */
function showError(message) {
  const descEl = document.getElementById('error-desc');
  if (descEl) descEl.textContent = message;
  setState('error');
}

/* ===================================================
   6. CTA 버튼 이벤트
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const ctaBtn = document.getElementById('btn-cta');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      // 호스트에 액션을 전달한다 (실제 연동 시 method/params 수정)
      postToHost('tools/call', {
        name: 'open_detail_view',
        arguments: { action: 'cta_clicked' },
      });
      // 로컬 미리보기에서는 콘솔에 출력
      console.log('[Widget] CTA 버튼 클릭됨 → 호스트에 메시지 전송');
    });
  }

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      // 재시도: 로딩 상태로 돌아간 뒤 mock 데이터 재렌더
      setState('loading');
      setTimeout(() => loadData(), 800);
    });
  }
});

/* ===================================================
   7. 초기화
   - 실제 환경: 호스트 메시지를 기다린다.
   - 로컬 미리보기: mock 데이터로 바로 렌더한다.
   =================================================== */

/**
 * 데이터를 불러온다.
 * - iframe 안(ChatGPT 실제 환경)에서는 postMessage 수신 후 renderData()를 호출한다.
 * - 로컬 미리보기에서는 1초 후 mock 데이터로 자동 렌더한다.
 */
function loadData() {
  setState('loading');

  // 로컬 여부 판별: 부모 frame이 자신과 같으면 로컬 환경
  const isLocal = (window.parent === window) ||
                  window.location.protocol === 'file:';

  if (isLocal) {
    // 로컬 미리보기: 1초 후 mock 데이터로 렌더
    setTimeout(() => {
      renderData(MOCK_DATA);

      // 빈 상태 / 에러 상태를 테스트하려면 아래 주석을 해제하세요.
      // setState('empty');
      // showError('서버 연결에 실패했습니다. 네트워크를 확인해 주세요.');
    }, 1000);
  }
  // iframe 안(실제 환경)에서는 message 이벤트가 오면 자동으로 처리된다.
}

// 페이지 로드 시 바로 시작
loadData();
