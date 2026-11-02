import { EXERCISES } from '../data/exercises/catalog';
import { bestSet, byStart } from './history';
import type { CompletedWorkout, ExerciseId, MaxEntry, Unit } from './types';

export interface WorkoutTotals {
  setsDone: number;
  setsPlanned: number;
  /** Reps of all rep-based exercises (done sets only). */
  reps: number;
  /** Seconds of all time-based exercises (done sets only). */
  seconds: number;
  /** Strict, unassisted pull-up variations (D16). */
  pullups: number;
  /** Best single set of `strict-pullup` in this workout. */
  bestStrictSet: number;
}

export function totalsOf(w: Pick<CompletedWorkout, 'exercises'>): WorkoutTotals {
  const t: WorkoutTotals = { setsDone: 0, setsPlanned: 0, reps: 0, seconds: 0, pullups: 0, bestStrictSet: 0 };
  for (const ex of w.exercises) {
    t.setsPlanned += ex.plannedSets;
    const def = EXERCISES[ex.exerciseId];
    for (const s of ex.sets) {
      if (s.status !== 'done') continue;
      t.setsDone += 1;
      if (ex.unit === 'seconds') t.seconds += s.actual;
      else t.reps += s.actual;
      if (def.family === 'pullup' && ex.unit === 'reps') t.pullups += s.actual;
    }
    if (ex.exerciseId === 'strict-pullup') t.bestStrictSet = Math.max(t.bestStrictSet, bestSet(ex));
  }
  return t;
}

export interface RecordHit {
  exerciseId: ExerciseId;
  unit: Unit;
  value: number;
  previous: number;
}

/**
 * Personal records of one workout — only real ones: a better single set than any
 * earlier logged set of the same exercise (and, for strict pull-ups, any earlier
 * max entry). First-time exercises have no previous best, so no "record".
 */
export function recordsOf(w: CompletedWorkout, all: readonly CompletedWorkout[], maxEntries: readonly MaxEntry[] = []): RecordHit[] {
  const earlier = all.filter((x) => x.id !== w.id && byStart(x, w) < 0);
  const out: RecordHit[] = [];
  const seen = new Set<ExerciseId>();
  for (const ex of w.exercises) {
    if (seen.has(ex.exerciseId)) continue;
    seen.add(ex.exerciseId);
    const value = Math.max(...w.exercises.filter((e) => e.exerciseId === ex.exerciseId).map(bestSet));
    if (value <= 0) continue;
    let previous = 0;
    for (const x of earlier) for (const e of x.exercises) if (e.exerciseId === ex.exerciseId) previous = Math.max(previous, bestSet(e));
    if (ex.exerciseId === 'strict-pullup') {
      for (const m of maxEntries) if (m.atUtc < w.startedAtUtc) previous = Math.max(previous, m.value);
    }
    if (previous > 0 && value > previous) out.push({ exerciseId: ex.exerciseId, unit: ex.unit, value, previous });
  }
  return out;
}
