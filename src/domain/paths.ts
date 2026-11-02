import { bestOf, type History } from './history';
import { workingMax } from './level';
import type { Equipment } from './types';

export interface PathState {
  /** 1-based current stage. */
  stage: number;
  /** All stages done (the last criterion is met). */
  complete: boolean;
}

/**
 * Pull-up Path: dead hang → scapular pulls → negatives → assisted → strict → weighted.
 * Stage n+1 is reached when the criterion of stage n is met (or any later one).
 */
export function pullupPath(history: Pick<History, 'workouts' | 'maxEntries'>): PathState {
  const w = history.workouts;
  const max = workingMax(history)?.value ?? 0;
  const met = [
    bestOf(w, 'dead-hang') >= 30 || bestOf(w, 'active-hang') >= 30,
    bestOf(w, 'scapular-pull') >= 10,
    bestOf(w, 'negative-pullup') >= 5,
    bestOf(w, 'band-pullup') >= 8 || max >= 1,
    max >= 12,
    bestOf(w, 'weighted-pullup') >= 5,
  ];
  return fromCriteria(met);
}

/** Muscle-up Path (section 5.6): stage criteria are plain, logged numbers. */
export function muscleUpPath(history: Pick<History, 'workouts' | 'maxEntries'>, equipment: readonly Equipment[]): PathState {
  const w = history.workouts;
  const max = workingMax(history)?.value ?? 0;
  const pushOk = equipment.includes('dipBars') ? bestOf(w, 'parallel-dips') >= 10 : bestOf(w, 'parallel-dips') >= 10 || bestOf(w, 'pushup') >= 15;
  const met = [
    max >= 8 && pushOk,
    bestOf(w, 'high-pullup') >= 5,
    bestOf(w, 'straight-bar-dip') >= 8,
    bestOf(w, 'negative-muscle-up') >= 3,
    bestOf(w, 'band-muscle-up') >= 3,
    bestOf(w, 'muscle-up') >= 1,
  ];
  return fromCriteria(met);
}

function fromCriteria(met: boolean[]): PathState {
  let last = -1;
  met.forEach((m, i) => {
    if (m) last = i;
  });
  const complete = last === met.length - 1;
  return { stage: complete ? met.length : last + 2, complete };
}
