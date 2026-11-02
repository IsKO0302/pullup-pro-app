import { useEffect, useState } from 'react';
import { localDateOf, type LocalDate } from '../domain/time';

export function currentTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function todayLocal(): LocalDate {
  return localDateOf(new Date(), currentTimeZone());
}

/** Today's local date; updates at local midnight and when the app becomes visible again. */
export function useToday(): LocalDate {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    let timer = 0;
    const check = () => {
      const d = todayLocal();
      setToday((prev) => (prev === d ? prev : d));
    };
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 2, 0);
      timer = window.setTimeout(() => {
        check();
        schedule();
      }, Math.max(1000, next.getTime() - now.getTime()));
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}

/** Re-renders every `ms` while mounted (timers in the workout screen). */
export function useTick(ms: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
  return now;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
