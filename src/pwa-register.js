if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // 설치 지원이 없는 환경에서도 기존 웹 흐름은 그대로 유지한다.
    });
  }, { once: true });
}
