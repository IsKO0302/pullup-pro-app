import { EXERCISES } from '../data/exercises/catalog';
import { bestSet, byStart, type History } from './history';
import { workingMax, type MaxEvidence } from './level';
import { muscleUpPath } from './paths';
import { scheduleRange } from './rotation';
import type { ScheduleProfile } from './schedule';
import { totalsOf } from './stats';
import { addDays, utcMidnight, weekStart, type LocalDate } from './time';
import { EXERCISE_IDS, type CompletedWorkout, type ExerciseId, type Profile, type RotationState, type Unit } from './types';
import { cellOf, indexDays, type DayState } from './week';

/* ── Header numbers ─────────────────────────────────────────────────────── */

export interface ProgressTotals {
  workouts: number;
  /** Unassisted pull-up reps, all grips (D16). */
  pullups: number;
  /** Current working max — strict pull-ups only (guardrail 6). */
  max: MaxEvidence | null;
}

export function progressTotals(history: Pick<History, 'workouts' | 'maxEntries'>): ProgressTotals {
  let pullups = 0;
  for (const w of history.workouts) pullups += totalsOf(w).pullups;
  return { workouts: history.workouts.length, pullups, max: workingMax(history) };
}

/* ── Pull-up max over time ──────────────────────────────────────────────── */

export interface MaxPoint {
  /** Monday of the week. */
  week: LocalDate;
  /** Best strict pull-up set of that week. */
  value: number;
  /** The workout that holds it (earliest one on ties). */
  workoutId: string;
  localDate: LocalDate;
  test: boolean;
}

/**
 * One point per week with logged strict pull-ups: the best single strict set
 * (section 9). Self-reports are not workouts, so they are not points; assisted
 * reps and negatives never appear here.
 */
export function maxSeries(workouts: readonly CompletedWorkout[]): MaxPoint[] {
  const byWeek = new Map<LocalDate, MaxPoint>();
  for (const w of [...workouts].sort(byStart)) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== 'strict-pullup') continue;
      const value = bestSet(ex);
      if (value <= 0) continue;
      const week = weekStart(w.localDate);
      const cur = byWeek.get(week);
      if (!cur || value > cur.value) byWeek.set(week, { week, value, workoutId: w.id, localDate: w.localDate, test: ex.role === 'test' });
    }
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/* ── Weekly rhythm ──────────────────────────────────────────────────────── */

export type RhythmDayState = DayState | 'none';

export interface RhythmWeek {
  start: LocalDate;
  /** Monday → Sunday; 'none' before the program started. */
  days: { date: LocalDate; state: RhythmDayState }[];
  /** Training slots of the week (from the program start). The weekly target counts these only. */
  planned: number;
  /** Days with a real training session (incl. sessions brought forward to a rest day). */
  done: number;
  /** Recovery slots of the week. */
  recoveryPlanned: number;
  /** Recovery sessions done (shown up to the planned number). */
  recoveryDone: number;
  /** Days the user chose to rest — never "missed"; the session moved on. */
  restChosen: number;
  /** none = before the start · current = this week · onPlan = training done ≥ planned (D54). */
  status: 'none' | 'current' | 'onPlan' | 'partial';
}

/** Weeks from `firstMonday` to `lastMonday` (inclusive) in one pass over the schedule. */
function weeksBetween(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  firstMonday: LocalDate,
  lastMonday: LocalDate,
  today: LocalDate,
  checkpoint?: RotationState | null,
): RhythmWeek[] {
  if (lastMonday < firstMonday) return [];
  const index = indexDays(history);
  const days = scheduleRange(profile, history, firstMonday, addDays(lastMonday, 6), today, checkpoint);
  const current = weekStart(today);
  const weeks: RhythmWeek[] = [];
  for (let w = 0; w * 7 < days.length; w++) {
    const chunk = days.slice(w * 7, w * 7 + 7);
    const start = chunk[0]!.date;
    let planned = 0;
    let done = 0;
    let recoveryPlanned = 0;
    let recoveryDone = 0;
    let restChosen = 0;
    const cells = chunk.map((d): RhythmWeek['days'][number] => {
      if (d.beforeStart) return { date: d.date, state: 'none' };
      if (d.slot === 'training') planned++;
      else if (d.slot === 'recovery') recoveryPlanned++;
      if (index.trained.has(d.date)) done++;
      if (index.recoverySessions.has(d.date)) recoveryDone++;
      if (index.recovery.has(d.date)) restChosen++;
      return { date: d.date, state: cellOf(index, d, today).state };
    });
    let status: RhythmWeek['status'];
    if (planned === 0 && done === 0 && recoveryPlanned === 0) status = 'none';
    else if (start === current) status = 'current';
    else status = done >= planned ? 'onPlan' : 'partial';
    weeks.push({ start, days: cells, planned, done, recoveryPlanned, recoveryDone: Math.min(recoveryDone, recoveryPlanned), restChosen, status });
  }
  return weeks;
}

/** The last `count` weeks, oldest first, the current week last. */
export function rhythmWeeks(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  today: LocalDate,
  count = 12,
  checkpoint?: RotationState | null,
): RhythmWeek[] {
  const current = weekStart(today);
  return weeksBetween(profile, history, addDays(current, -7 * (count - 1)), current, today, checkpoint);
}

/** Completed weeks on plan / completed weeks with a plan, among `weeks`. */
export function rhythmSummary(weeks: readonly RhythmWeek[]): { onPlan: number; weeks: number } {
  const complete = weeks.filter((w) => w.status === 'onPlan' || w.status === 'partial');
  return { onPlan: complete.filter((w) => w.status === 'onPlan').length, weeks: complete.length };
}

/* ── Best sets per exercise ─────────────────────────────────────────────── */

export interface BestSetRow {
  exerciseId: ExerciseId;
  unit: Unit;
  value: number;
  localDate: LocalDate;
  workoutId: string;
}

/** Each variation keeps its own record (assisted and negatives are separate rows). */
export function bestSets(workouts: readonly CompletedWorkout[]): BestSetRow[] {
  const best = new Map<ExerciseId, BestSetRow>();
  for (const w of [...workouts].sort(byStart)) {
    for (const ex of w.exercises) {
      if (EXERCISES[ex.exerciseId].pattern === 'mobility') continue;
      const value = bestSet(ex);
      const cur = best.get(ex.exerciseId);
      if (value > 0 && (!cur || value > cur.value)) best.set(ex.exerciseId, { exerciseId: ex.exerciseId, unit: ex.unit, value, localDate: w.localDate, workoutId: w.id });
    }
  }
  // Strict pull-ups first (the number this app is about), then catalog order.
  const order: ExerciseId[] = ['strict-pullup', ...EXERCISE_IDS.filter((id) => id !== 'strict-pullup')];
  return order.flatMap((id) => best.get(id) ?? []);
}

/* ── Milestones ─────────────────────────────────────────────────────────── */

export const MILESTONES = [
  'firstWorkout', 'firstStrict', 'workouts10', 'workouts50', 'workouts100', 'pullups100',
  'pullups1000', 'firstRecord', 'rhythm4', 'firstMaxTest', 'muscleUpStage', 'oneYear',
] as const;
export type MilestoneId = (typeof MILESTONES)[number];

export interface Milestone {
  id: MilestoneId;
  /** Local date it was reached; null = not yet (the UI shows the criterion). */
  reachedOn: LocalDate | null;
}

export function addYears(date: LocalDate, years: number): LocalDate {
  const d = new Date(utcMidnight(date));
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * Up to 12 milestones derived from real data only. Records follow the same rule
 * as the completion screen: a better single set than every earlier one (and,
 * for strict pull-ups, every earlier self-reported max). No XP, no levels.
 */
export function milestones(profile: ScheduleProfile & Pick<Profile, 'equipment'>, history: History, today: LocalDate): Milestone[] {
  const reached = new Map<MilestoneId, LocalDate>();
  const hit = (id: MilestoneId, date: LocalDate) => {
    if (!reached.has(id)) reached.set(id, date);
  };
  const workouts = [...history.workouts].sort(byStart);
  const entries = [...history.maxEntries].sort((a, b) => a.atUtc.localeCompare(b.atUtc));
  const best = new Map<ExerciseId, number>();
  let pullups = 0;
  workouts.forEach((w, i) => {
    const n = i + 1;
    if (n === 1) hit('firstWorkout', w.localDate);
    if (n === 10) hit('workouts10', w.localDate);
    if (n === 50) hit('workouts50', w.localDate);
    if (n === 100) hit('workouts100', w.localDate);
    pullups += totalsOf(w).pullups;
    if (pullups >= 100) hit('pullups100', w.localDate);
    if (pullups >= 1000) hit('pullups1000', w.localDate);

    const valueOf = new Map<ExerciseId, number>();
    for (const ex of w.exercises) valueOf.set(ex.exerciseId, Math.max(valueOf.get(ex.exerciseId) ?? 0, bestSet(ex)));
    for (const [id, value] of valueOf) {
      let previous = best.get(id) ?? 0;
      if (id === 'strict-pullup') for (const m of entries) if (m.atUtc < w.startedAtUtc) previous = Math.max(previous, m.value);
      if (previous > 0 && value > previous) hit('firstRecord', w.localDate);
    }
    for (const [id, value] of valueOf) best.set(id, Math.max(best.get(id) ?? 0, value));

    if ((valueOf.get('strict-pullup') ?? 0) >= 1) hit('firstStrict', w.localDate);
    if (w.type === 'maxTest' && w.exercises.some((ex) => ex.role === 'test' && ex.sets.some((s) => s.status === 'done'))) hit('firstMaxTest', w.localDate);
    if (!reached.has('muscleUpStage')) {
      const soFar = { workouts: workouts.slice(0, n), maxEntries: entries.filter((m) => m.atUtc <= w.completedAtUtc) };
      if (muscleUpPath(soFar, profile.equipment).stage >= 2) hit('muscleUpStage', w.localDate);
    }
  });

  // 4 complete weeks in a row on plan, each with at least one real session.
  let run = 0;
  for (const wk of weeksBetween(profile, history, weekStart(profile.startDate), addDays(weekStart(today), -7), today)) {
    run = wk.status === 'onPlan' && wk.done > 0 ? run + 1 : 0;
    if (run === 4) {
      hit('rhythm4', addDays(wk.start, 6));
      break;
    }
  }

  const first = workouts[0];
  if (first) {
    const anniversary = addYears(first.localDate, 1);
    if (anniversary <= today) hit('oneYear', anniversary);
  }
  return MILESTONES.map((id) => ({ id, reachedOn: reached.get(id) ?? null }));
}
