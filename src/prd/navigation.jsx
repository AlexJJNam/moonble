import React, { useEffect, useMemo, useState } from 'react';

export function routeHref(path) { return `#${path === '/' ? '/list' : path}`; }
const router = {
  push(path) { window.location.hash = routeHref(path); },
  replace(path) { window.location.replace(routeHref(path)); },
};
export function useRouter() { return router; }
export function useRoute() {
  // 워크스페이스는 시간표가 기본 화면이다(PRD 목록은 #/list).
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/schedule');
  useEffect(() => {
    const change = () => setRoute(window.location.hash.slice(1) || '/schedule');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
export function useSearchParams() {
  const route = useRoute();
  return useMemo(() => new URLSearchParams(route.split('?')[1] || ''), [route]);
}
export function Link({ href, children, ...props }) {
  return <a {...props} href={routeHref(href)}>{children}</a>;
}
