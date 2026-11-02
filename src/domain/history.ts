import type { CompletedWorkout, DayType, ExerciseId, LoggedExercise, MaxEntry, RecoveryDay } from './types';
import type { LocalDate } from './time';

/** Everything the engine may look at. Pure data, no storage handles. */
export interface History {
  workouts: readonly CompletedWorkout[];
  recoveryDays: readonly RecoveryDay[];
  maxEntries: readonly MaxEntry[];
}

export const EMPTY_HISTORY: History = { workouts: [], recoveryDays: [], maxEntries: [] };

/** Session types that count as real training (light/recovery extras do not break a "gap"). */
export const TRAINING_TYPES: readonly DayType[] = ['pullStrength', 'pullVolume', 'push', 'legsCore', 'maxTest', 'short'];

export function isTraining(w: CompletedWorkout): boolean {
  return TRAINING_TYPES.includes(w.type);
}

export function byStart(a: CompletedWorkout, b: CompletedWorkout): number {
  return a.startedAtUtc.localeCompare(b.startedAtUtc);
}

/** Workouts strictly before `date`, oldest first. */
export function workoutsBefore(history: History, date: LocalDate): CompletedWorkout[] {
  return history.workouts.filter((w) => w.localDate < date).sort(byStart);
}

/** Best completed set (reps or seconds) of a logged exercise; 0 if none. */
export function bestSet(ex: LoggedExercise): number {
  let best = 0;
  for (const s of ex.sets) if (s.status === 'done' && s.actual > best) best = s.actual;
  return best;
}

/** Best single set of an exercise across workouts (actually performed, not swapped away). */
export function bestOf(workouts: readonly CompletedWorkout[], id: ExerciseId): number {
  let best = 0;
  for (const w of workouts) for (const ex of w.exercises) if (ex.exerciseId === id) best = Math.max(best, bestSet(ex));
  return best;
}
