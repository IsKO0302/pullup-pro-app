import type { History } from './history';
import { bestSet } from './history';
import type { LocalDate } from './time';
import type { Level } from './types';

/** L0: 0 · L1: 1–3 · L2: 4–7 · L3: 8–12 · L4: 13+ strict pull-ups in one set. */
export function levelFromMax(max: number | null | undefined): Level {
  if (!max || max <= 0) return 0;
  if (max <= 3) return 1;
  if (max <= 7) return 2;
  if (max <= 12) return 3;
  return 4;
}

export type MaxSource = 'setup' | 'self' | 'test' | 'set';

export interface MaxEvidence {
  value: number;
  source: MaxSource;
  localDate: LocalDate;
  atUtc: string;
}

/**
 * Pull-up max evidence — ONLY strict, unassisted `strict-pullup` work (guardrail 6):
 * setup answer, self-report, max tests and normal strict sets. Assisted reps,
 * negatives and other variations are separate records.
 */
export function maxEvidence(history: Pick<History, 'workouts' | 'maxEntries'>, upTo?: LocalDate): MaxEvidence[] {
  const out: MaxEvidence[] = [];
  for (const e of history.maxEntries) {
    if (upTo && e.localDate > upTo) continue;
    out.push({ value: e.value, source: e.source, localDate: e.localDate, atUtc: e.atUtc });
  }
  for (const w of history.workouts) {
    if (upTo && w.localDate > upTo) continue;
    let test = -1;
    let set = 0;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== 'strict-pullup') continue;
      const best = bestSet(ex);
      if (ex.role === 'test') {
        if (ex.sets.some((s) => s.status === 'done')) test = Math.max(test, best);
      } else {
        set = Math.max(set, best);
      }
    }
    if (test >= 0) out.push({ value: test, source: 'test', localDate: w.localDate, atUtc: w.completedAtUtc });
    if (set > 0) out.push({ value: set, source: 'set', localDate: w.localDate, atUtc: w.completedAtUtc });
  }
  return out.sort((a, b) => a.atUtc.localeCompare(b.atUtc) || (a.source === 'test' ? -1 : 1));
}

/**
 * Current working max: the latest explicit value (setup / self-report / test)
 * raised by any strict set logged after it. An honest lower test or self-report
 * resets it — the plan follows the body you have today.
 */
export function workingMax(history: Pick<History, 'workouts' | 'maxEntries'>, upTo?: LocalDate): MaxEvidence | null {
  const ev = maxEvidence(history, upTo);
  let current: MaxEvidence | null = null;
  for (const e of ev) {
    if (e.source !== 'set') current = e;
    else if (!current || e.value > current.value) current = e;
  }
  return current;
}
