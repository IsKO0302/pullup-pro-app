/**
 * Test fixtures for the pure domain (no storage, no DOM). Used by *.test.ts only;
 * nothing here is bundled into the app.
 */
import { EXERCISES } from '../data/exercises/catalog';
import type { History } from '../domain/history';
import { planDay, type PlanOptions } from '../domain/plan';
import { scheduledType } from '../domain/schedule';
import { addDays, type LocalDate } from '../domain/time';
import type {
  CompletedWorkout, LoggedExercise, MaxEntry, PlannedExercise, Profile, RecoveryDay, RecoveryReason, Workout,
} from '../domain/types';

/** A Monday: program week 0 starts here. */
export const START: LocalDate = '2026-01-05';
/** Monday of program week 1 (a normal week: not lighter, no max test). */
export const WEEK1: LocalDate = '2026-01-12';
/** Monday of program week 3 (lighter week). */
export const WEEK3: LocalDate = '2026-01-26';
/** Monday of program week 4 (max test suggested). */
export const WEEK4: LocalDate = '2026-02-02';

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    name: 'Test',
    lang: 'en',
    equipment: ['bar'],
    daysPerWeek: 4,
    sessionMinutes: 30,
    goals: [],
    startDate: START,
    createdAtUtc: '2026-01-05T08:00:00.000Z',
    onboarding: 'done',
    ...over,
  };
}

export function maxEntry(value: number, localDate: LocalDate = START, source: MaxEntry['source'] = 'setup', hour = 7): MaxEntry {
  return { value, source, localDate, atUtc: `${localDate}T${String(hour).padStart(2, '0')}:00:00.000Z`, timeZone: 'UTC' };
}

export function recoveryDay(localDate: LocalDate, reason: RecoveryReason | null): RecoveryDay {
  return { reason, localDate, atUtc: `${localDate}T09:00:00.000Z`, timeZone: 'UTC' };
}

export function history(part: Partial<History> = {}): History {
  return { workouts: [], recoveryDays: [], maxEntries: [], ...part };
}

/** Reps/seconds done in a set; `null` = skipped. */
export type Perform = (ex: PlannedExercise, setIndex: number) => number | null;
export const asPlanned: Perform = (ex) => ex.target;

export function logged(ex: PlannedExercise, perform: Perform, atUtc: string, swappedFrom: LoggedExercise['swappedFrom'] = null): LoggedExercise {
  return {
    exerciseId: ex.exerciseId,
    slot: ex.slot,
    unit: EXERCISES[ex.exerciseId].unit,
    role: ex.role,
    target: ex.target,
    plannedSets: ex.sets,
    restSec: ex.restSec,
    sets: Array.from({ length: ex.sets }, (_, i) => {
      const actual = perform(ex, i);
      return actual === null
        ? { target: ex.target, actual: 0, status: 'skipped' as const, atUtc }
        : { target: ex.target, actual, status: 'done' as const, atUtc };
    }),
    swappedFrom,
  };
}

/** A completed workout that followed `plan` (all sets as performed by `perform`). */
export function complete(plan: Workout, perform: Perform = asPlanned, hour = 18): CompletedWorkout {
  const hh = String(hour).padStart(2, '0');
  const startedAtUtc = `${plan.localDate}T${hh}:00:00.000Z`;
  const completedAtUtc = `${plan.localDate}T${hh}:40:00.000Z`;
  return {
    id: `w-${plan.localDate}-${plan.type}-${hh}`,
    type: plan.type,
    level: plan.level,
    startedAtUtc,
    completedAtUtc,
    localDate: plan.localDate,
    timeZone: 'UTC',
    durationSec: plan.estimatedMinutes * 60,
    exercises: plan.exercises.map((ex) => logged(ex, perform, completedAtUtc)),
    flags: plan.flags,
    mood: null,
    note: '',
    finishedEarly: false,
  };
}

/**
 * Follows the planned rotation for `days` days from `from`, doing every set as
 * `perform` says. With `takeTests`, a suggested max test is taken.
 */
export function simulate(profile: Profile, h: History, from: LocalDate, days: number, perform: Perform = asPlanned, opts: PlanOptions & { takeTests?: boolean } = {}): History {
  let current = h;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!scheduledType(profile.daysPerWeek, date)) continue;
    let plan = planDay(profile, current, date, opts);
    if (opts.takeTests && plan.flags.maxTestSuggested) plan = planDay(profile, current, date, { ...opts, variant: 'maxTest' });
    current = { ...current, workouts: [...current.workouts, complete(plan, perform)] };
  }
  return current;
}

export function totalSets(w: Workout): number {
  return w.exercises.reduce((sum, e) => sum + e.sets, 0);
}

export function find(w: Workout, slotKey: string): PlannedExercise | undefined {
  return w.exercises.find((e) => e.slot === `${w.type}.${slotKey}`);
}
