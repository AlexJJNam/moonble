// 페이지가 제공하는 잠금 관리자가 있으면 그 관리자만 사용한다.
// 그렇지 않은 화면에서만 이 모듈의 참조 카운트를 사용한다.
let fallbackCount = 0;
let saved = null;

export function lockPageScroll() {
  const external = window.moonbleScrollLock;
  if (typeof external?.lock === 'function' && typeof external?.unlock === 'function') {
    external.lock();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      external.unlock();
    };
  }
  fallbackCount += 1;
  if (fallbackCount === 1) {
    const root = document.documentElement;
    const body = document.body;
    saved = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, overscroll: root.style.overscrollBehavior };
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fallbackCount = Math.max(0, fallbackCount - 1);
    if (fallbackCount > 0 || !saved) return;
    const root = document.documentElement;
    root.style.overflow = saved.rootOverflow;
    document.body.style.overflow = saved.bodyOverflow;
    root.style.overscrollBehavior = saved.overscroll;
    saved = null;
  };
}
