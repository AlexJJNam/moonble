import React, { useEffect, useMemo, useState } from 'react';

export function routeHref(path) { return `#${path === '/' ? '/list' : path}`; }
const router = {
  push(path) { window.location.hash = routeHref(path); },
  replace(path) { window.location.replace(routeHref(path)); },
};
export function useRouter() { return router; }
export function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/list');
  useEffect(() => {
    const change = () => setRoute(window.location.hash.slice(1) || '/list');
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
