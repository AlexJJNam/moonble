const CAUTION_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="10" cy="10" r="10" fill="#141414"/>
  <text x="10" y="14.5" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="11.5" fill="white">i</text>
</svg>`;

const BULLET = `<svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="3" cy="3" r="3" fill="#555"/>
</svg>`;

const items = [
  '해당 이벤트 적용 대상은 한정 기간 내 본 이벤트 페이지 하단 버튼을 통해 결제하신 회원님 대상이며, 다른 경로로 결제 시 혜택이 적용되지 않습니다.',
  '이벤트 내용은 내부 사정에 따라 변경 또는 조기 종료될 수 있습니다.',
  '본 혜택은 계정과 무관하게 1인 1회만 제공됩니다.',
  '투자성향진단은 본인인증 후 완료되며, 꼭 업그레이드 된 서비스를 위해 투자성향진단을 진행해 주세요.',
  '위 포켓의 경우 투자 및 종목추천의 내용이 아니며, 투자에 대한 손실은 투자자 본인에게 귀속됩니다.',
  '본 이벤트 페이지는 AI 생성 이미지가 포함되어 있습니다.',
  '이벤트 참여가 어려우신 경우, 고객센터로 문의해 주시면 친절하게 안내해 드리겠습니다.',
  '고객센터는 아래 각 경로를 통해 연결이 가능합니다. (고객센터 운영시간은 평일 오전 9시~오후 5시까지, 점심시간 오전 11시 30분~오후 1시 입니다.)',
];

const itemsHTML = items.map(text => `
  <div class="shared-footer-item">
    <span class="shared-footer-bullet">${BULLET}</span>
    <p class="shared-footer-item-text">${text}</p>
  </div>`).join('');

const footerHTML = `
<footer class="shared-footer">
  <div class="shared-footer-inner">
    <div class="shared-footer-title">
      ${CAUTION_ICON}
      <span class="shared-footer-title-text">이벤트 유의 사항</span>
    </div>
    <div class="shared-footer-list">
      ${itemsHTML}
      <div class="shared-footer-contact">
        <ul>
          <li>카카오톡 : 라씨매매비서 채널</li>
          <li>앱 내 고객센터 : 라씨 매매비서 앱 &gt; MY &gt; 1대1 문의</li>
          <li>유선 : 02-2174-6446</li>
        </ul>
      </div>
    </div>
  </div>
</footer>`;

document.getElementById('shared-footer').outerHTML = footerHTML;
