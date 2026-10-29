// 대화상자·전체 화면이 열려 있는 동안 뒤 페이지가 스크롤·바운스되지 않게 한다.
// solve.html처럼 페이지에 moonbleScrollLock이 있으면 그것을 함께 쓴다.
let count = 0;
let saved = null;

export function lockPageScroll() {
  const external = window.moonbleScrollLock;
  external?.lock();
  count += 1;
  if (count === 1) {
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
    external?.unlock();
    count = Math.max(0, count - 1);
    if (count > 0 || !saved) return;
    const root = document.documentElement;
    root.style.overflow = saved.rootOverflow;
    document.body.style.overflow = saved.bodyOverflow;
    root.style.overscrollBehavior = saved.overscroll;
    saved = null;
  };
}
