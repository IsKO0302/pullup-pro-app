import { useSyncExternalStore } from 'react';

/**
 * Service worker + update prompt (spec §14): everything is precached, the app
 * works offline, and a new version NEVER interrupts a workout — it waits until
 * the user taps "Restart now", which is only offered when no session is active.
 */
type Apply = () => Promise<void>;

let ready = false;
let apply: Apply | null = null;
const listeners = new Set<() => void>();

function setReady(next: boolean) {
  ready = next;
  for (const l of listeners) l();
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        apply = () => update(true);
        setReady(true);
      },
      onRegisteredSW(_url, registration) {
        // A long-lived installed app should still notice new versions (hourly, when online).
        if (registration) setInterval(() => { if (navigator.onLine) void registration.update(); }, 60 * 60 * 1000);
      },
    });
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** True when a new version is downloaded and waiting. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

/**
 * Activates the waiting version and reloads. Refuses while a workout is active
 * (the caller passes the current session) — the prompt waits instead.
 */
export async function applyUpdate(activeSession: unknown): Promise<boolean> {
  if (activeSession || !apply) return false;
  await apply();
  return true;
}

/** Dev/e2e only (see dev/hooks.ts): pretend a new version is waiting. */
export function simulateUpdateForTest(onApply: Apply) {
  apply = onApply;
  setReady(true);
}
