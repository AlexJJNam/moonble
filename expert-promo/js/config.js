/* User-provided expert mappings. Keep bridge parameters as strings. */
window.EXPERT_PROMO_CONFIG = {
  deadline: '2026-10-02T23:59:59+09:00',
  // 전문가 사진을 누르면 여는 소개 이미지. {expertId}는 전문가 ID로 바뀝니다. 전문가별로 다르게 쓰려면 products에 introImage를 넣으세요.
  introImage: 'https://files.thinkpool.com/rassi_signal/expert/{expertId}_page.png',
  products: {
    'surge-hunter': { expertId: 'ebirang22', productId: 'rc_e15.am1d5', discountPct: '55', discountAmt: '220000' }, // 서지헌터
    'trader-shin': { expertId: 'kkmad111', productId: 'rc_e14.am1d5', discountPct: '55', discountAmt: '220000' }, // 트레이더신
    'absolute-wealth': { expertId: 'ixtous', productId: 'rc_e11.am1d5', discountPct: '55', discountAmt: '220000' }, // 절대부유
    'gold-spoon': { expertId: 'acafera', productId: 'rc_e13.am1d5', discountPct: '55', discountAmt: '220000' } // 금수저
  }
};
