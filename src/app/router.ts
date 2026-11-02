import { useMemo, useSyncExternalStore } from 'react';

/** Minimal hash router: "#/progress/workout/abc" → ["progress", "workout", "abc"]. */
export function parseHash(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => decodeURIComponent(p));
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = `#/${path.replace(/^\//, '')}`;
  if (opts.replace) {
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = url;
  }
  window.scrollTo(0, 0);
}
