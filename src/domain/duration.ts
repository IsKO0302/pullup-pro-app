import { EXERCISES } from '../data/exercises/catalog';
import type { PlannedExercise } from './types';

/** Seconds to get into position / chalk up / read the screen before a set. */
export const SET_SETUP_SEC = 8;
/** Moving to the next exercise (on top of the rest). */
export const TRANSITION_SEC = 15;

export function setSeconds(ex: Pick<PlannedExercise, 'exerciseId' | 'target'>): number {
  const def = EXERCISES[ex.exerciseId];
  const sides = def.perSide ? 2 : 1;
  const work = def.unit === 'seconds' ? ex.target : ex.target * def.secPerRep;
  return Math.round(work * sides + SET_SETUP_SEC);
}

/** Realistic estimate: work + rest after every set except the very last one + transitions. */
export function estimateSeconds(exercises: readonly PlannedExercise[]): number {
  let total = 0;
  exercises.forEach((ex, i) => {
    const last = i === exercises.length - 1;
    total += ex.sets * setSeconds(ex);
    total += (last ? ex.sets - 1 : ex.sets) * ex.restSec;
    if (!last) total += TRANSITION_SEC;
  });
  return Math.max(0, total);
}

export function estimateMinutes(exercises: readonly PlannedExercise[]): number {
  return Math.max(1, Math.round(estimateSeconds(exercises) / 60));
}

export interface FitItem {
  /** Planned exercise; `ex.sets` is the designed ("base") number of sets. */
  ex: PlannedExercise;
  minSets: number;
  maxSets: number;
  minRest: number;
  maxRest: number;
}

/**
 * Fits a session to the chosen length (±15 %), deterministic:
 * A) the main block grows to its designed sets, B) further exercises join in
 * priority order while they fit, C) sets grow toward the design, D) then toward
 * the maximum, E) rest times are nudged within bounds for the last bit.
 * Items must be in priority order (main first).
 */
export function fitDuration(items: readonly FitItem[], targetMinutes: number): PlannedExercise[] {
  if (items.length === 0) return [];
  const target = targetMinutes * 60;
  const lo = target * 0.85;
  const hi = target * 1.15;
  const soft = target * 1.05;
  const base = new Map(items.map((i) => [i, i.ex.sets]));
  const chosen = [{ ...items[0]!, ex: { ...items[0]!.ex, sets: items[0]!.minSets } }];
  const baseOf = (i: FitItem) => base.get(items.find((x) => x.ex.slot === i.ex.slot)!) ?? i.ex.sets;
  const est = () => estimateSeconds(chosen.map((i) => i.ex));
  const tryAdd = (item: FitItem, limit: number) => {
    item.ex.sets += 1;
    if (est() > limit) {
      item.ex.sets -= 1;
      return false;
    }
    return true;
  };

  const main = chosen[0]!;
  while (main.ex.sets < baseOf(main) && tryAdd(main, soft));

  for (const item of items.slice(1)) {
    // Join with at least two sets (unless designed as a single set) — one-set fragments are noise.
    const joinSets = Math.max(item.minSets, Math.min(2, item.ex.sets));
    const candidate = { ...item, ex: { ...item.ex, sets: joinSets } };
    chosen.push(candidate);
    if (est() > target) chosen.pop();
  }

  const grow = (limitOf: (i: FitItem) => number, limit: number, until: () => boolean) => {
    let progressed = true;
    while (progressed && !until()) {
      progressed = false;
      for (const item of chosen) {
        if (until()) break;
        if (item.ex.sets < limitOf(item) && tryAdd(item, limit)) progressed = true;
      }
    }
  };
  grow(baseOf, soft, () => false);
  grow((i) => i.maxSets, hi, () => est() >= lo);

  const total = est();
  if (total < lo || total > hi) {
    const goal = total < lo ? (lo + target) / 2 : (hi + target) / 2;
    const restNow = chosen.reduce((sum, i, idx) => sum + (idx === chosen.length - 1 ? i.ex.sets - 1 : i.ex.sets) * i.ex.restSec, 0);
    if (restNow > 0) {
      const factor = (restNow + (goal - total)) / restNow;
      for (const i of chosen) {
        const r = Math.round((i.ex.restSec * factor) / 5) * 5;
        i.ex.restSec = Math.min(i.maxRest, Math.max(i.minRest, r));
      }
    }
  }
  return chosen.map((i) => i.ex);
}
