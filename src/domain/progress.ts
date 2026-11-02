import { EXERCISES } from '../data/exercises/catalog';
import { bestSet, byStart, type History } from './history';
import { workingMax, type MaxEvidence } from './level';
import { muscleUpPath } from './paths';
import { scheduledOn } from './schedule';
import { totalsOf } from './stats';
import { addDays, utcMidnight, weekStart, type LocalDate } from './time';
import { EXERCISE_IDS, type CompletedWorkout, type ExerciseId, type Profile, type Unit } from './types';
import { dayStateIn, indexDays, type DayIndex, type DayState } from './week';

type ScheduleProfile = Pick<Profile, 'daysPerWeek' | 'rhythmChanges' | 'startDate'>;

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
  /** Planned training days (planned rest and optional recovery sessions excluded). */
  planned: number;
  /** Days with a real training session (incl. sessions brought forward to a rest day). */
  done: number;
  /** Planned training days the user chose to rest — part of the plan, never "missed". */
  recovery: number;
  /** none = before the start · current = this week · onPlan = done + recovery ≥ planned. */
  status: 'none' | 'current' | 'onPlan' | 'partial';
}

function rhythmWeek(index: DayIndex, profile: ScheduleProfile, start: LocalDate, today: LocalDate): RhythmWeek {
  const days: RhythmWeek['days'] = [];
  let planned = 0;
  let done = 0;
  let recovery = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    if (date < profile.startDate) {
      days.push({ date, state: 'none' });
      continue;
    }
    days.push({ date, state: dayStateIn(index, profile, date, today).state });
    const type = scheduledOn(profile, date);
    const plannedTraining = type !== null && type !== 'recovery';
    if (plannedTraining) planned++;
    if (index.trained.has(date)) done++;
    else if (plannedTraining && index.recovery.has(date)) recovery++;
  }
  let status: RhythmWeek['status'];
  if (planned === 0 && done === 0) status = 'none';
  else if (start === weekStart(today)) status = 'current';
  else status = done + recovery >= planned ? 'onPlan' : 'partial';
  return { start, days, planned, done, recovery, status };
}

/** The last `count` weeks, oldest first, the current week last. */
export function rhythmWeeks(profile: ScheduleProfile, history: Pick<History, 'workouts' | 'recoveryDays'>, today: LocalDate, count = 12): RhythmWeek[] {
  const index = indexDays(history);
  const first = addDays(weekStart(today), -7 * (count - 1));
  return Array.from({ length: count }, (_, i) => rhythmWeek(index, profile, addDays(first, 7 * i), today));
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
  const index = indexDays(history);
  const current = weekStart(today);
  let run = 0;
  for (let start = weekStart(profile.startDate); start < current; start = addDays(start, 7)) {
    const wk = rhythmWeek(index, profile, start, today);
    run = wk.status === 'onPlan' && wk.done > 0 ? run + 1 : 0;
    if (run === 4) {
      hit('rhythm4', addDays(start, 6));
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
