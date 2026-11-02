import { EXERCISES, hasEquipment, type ExerciseDef } from '../data/exercises/catalog';
import { estimateMinutes, fitDuration, type FitItem } from './duration';
import { EMPTY_HISTORY, TRAINING_TYPES, isTraining, workoutsBefore, type History } from './history';
import { levelFromMax, workingMax } from './level';
import { muscleUpPath } from './paths';
import { isBalancedTemplate, isLighterWeek, isMaxTestWeek, scheduledType } from './schedule';
import { LEGS_CORE, LIGHT, PULL_STRENGTH, PULL_VOLUME, PUSH, RECOVERY, balanceSlots, skillSlot, type SlotOption, type SlotSpec } from './slots';
import { addDays, daysBetween, type LocalDate } from './time';
import type {
  CompletedWorkout, DayType, Equipment, ExerciseId, Level, LoggedExercise, Muscle, PlannedExercise, Profile, Workout,
} from './types';

export type Variant = 'planned' | 'short' | 'light' | 'maxTest';

export interface PlanOptions {
  variant?: Variant;
  /** "Feeling off today? Make it lighter" (−30 % volume). */
  feelingOff?: boolean;
}

export const FACTORS = {
  lighterWeek: 0.6,
  returnFirst: 0.7,
  returnSecond: 0.85,
  feelingOff: 0.7,
  floor: 0.4,
} as const;

const PULL_TYPES: readonly DayType[] = ['pullStrength', 'pullVolume', 'maxTest', 'short'];

/** Strict-pull-up work stays 2 reps short of the working max (2–3 RIR, guardrail 4). */
export const RESERVE_REPS = 2;

interface Ctx {
  profile: Profile;
  date: LocalDate;
  level: Level;
  max: number | null;
  owned: readonly Equipment[];
  canPull: boolean;
  before: CompletedWorkout[];
  history: History;
  painRecently: boolean;
  tiredRecently: boolean;
  holdProgress: boolean;
  returnFactor: number;
}

function inRange(date: LocalDate, from: LocalDate, to: LocalDate) {
  return date >= from && date <= to;
}

/** 0.7 on the first session after 7+ days without training, 0.85 on the second, then 1. */
export function returnFactor(history: History, date: LocalDate): number {
  const training = workoutsBefore(history, date).filter(isTraining);
  const last = training[training.length - 1];
  if (!last) return 1;
  if (daysBetween(last.localDate, date) >= 7) return FACTORS.returnFirst;
  for (let i = training.length - 1; i >= 1; i--) {
    if (daysBetween(training[i - 1]!.localDate, training[i]!.localDate) >= 7) {
      return training.length - i === 1 ? FACTORS.returnSecond : 1;
    }
  }
  return 1;
}

function context(profile: Profile, history: History, date: LocalDate): Ctx {
  const before = workoutsBefore(history, date);
  const wm = workingMax({ workouts: before, maxEntries: history.maxEntries }, date);
  const owned = profile.equipment;
  const recovery = history.recoveryDays;
  return {
    profile,
    date,
    level: levelFromMax(wm?.value ?? 0),
    max: wm ? wm.value : null,
    owned,
    canPull: owned.includes('bar') || owned.includes('rings'),
    before,
    history,
    painRecently: recovery.some((r) => (r.reason === 'pain' || r.reason === 'ill') && inRange(r.localDate, addDays(date, -7), date)),
    tiredRecently: recovery.some((r) => r.reason === 'tired' && inRange(r.localDate, addDays(date, -3), date)),
    holdProgress: recovery.some((r) => r.reason !== null && r.reason !== 'busy' && inRange(r.localDate, addDays(date, -1), date)),
    returnFactor: returnFactor(history, date),
  };
}

function usable(id: ExerciseId, ctx: Ctx, used: ReadonlySet<ExerciseId>, checkLevel: boolean): boolean {
  const def = EXERCISES[id];
  if (used.has(id) || def.optional || !hasEquipment(def, ctx.owned)) return false;
  return !checkLevel || (ctx.level >= def.levelRange[0] && ctx.level <= def.levelRange[1]);
}

function baseTarget(opt: SlotOption, ctx: Ctx): number {
  const def = EXERCISES[opt.id];
  if (opt.fromMax !== undefined && ctx.max !== null) {
    return Math.min(opt.cap ?? 99, Math.max(1, Math.floor(ctx.max * opt.fromMax)));
  }
  return opt.target ?? def.start;
}

/** Ceiling of a max-based slot: the slot cap, but never closer than RESERVE_REPS to the working max. */
function ceilingOf(opt: SlotOption | undefined, ctx: Ctx, base: number): number | undefined {
  if (!opt || opt.fromMax === undefined || ctx.max === null) return opt?.cap;
  return Math.min(opt.cap ?? 99, Math.max(base, ctx.max - RESERVE_REPS));
}

export function targetRange(def: ExerciseDef, base: number, cap?: number): [number, number] {
  if (def.unit === 'seconds') {
    return [Math.max(10, Math.round((base * 0.5) / 5) * 5), Math.max(60, base * 3)];
  }
  const lo = Math.max(1, Math.floor(base * 0.5));
  const hi = cap ?? Math.max(base + 8, Math.round(base * 2.5));
  return [lo, Math.max(hi, base)];
}

function related(a: ExerciseId, b: ExerciseId): boolean {
  const seen = new Set<ExerciseId>([a]);
  let frontier: ExerciseId[] = [a];
  for (let depth = 0; depth < 3; depth++) {
    const next: ExerciseId[] = [];
    for (const id of frontier) {
      for (const n of [...EXERCISES[id].harder, ...EXERCISES[id].easier]) {
        if (n === b) return true;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return false;
}

const isNormal = (w: CompletedWorkout) => !w.flags.lighterWeek && !w.flags.returnAfterBreak && !w.flags.feelingOff;

/** Last log of a slot from a normal (not deliberately reduced) workout. */
export function lastSlotLog(workouts: readonly CompletedWorkout[], slot: string): LoggedExercise | null {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i]!;
    if (!isNormal(w)) continue;
    const ex = w.exercises.find((e) => e.slot === slot);
    if (ex) return ex;
  }
  return null;
}

interface Choice {
  id: ExerciseId;
  target: number;
}

/**
 * Double progression (5.4): all sets at target → +1 rep (+5 s) next time, or the
 * next harder variation at the ceiling; two or more sets missed by 2+ → −1, or
 * one variation back at the floor. Never harder the day after a recovery day.
 */
function progress(spec: SlotSpec, slot: string, choice: Choice, ctx: Ctx, used: ReadonlySet<ExerciseId>): Choice {
  const last = lastSlotLog(ctx.before, slot);
  if (!last || last.swappedFrom) return choice;
  const id = last.exerciseId;
  if (id !== choice.id && (!spec.vary || !usable(id, ctx, used, false) || !related(choice.id, id))) return choice;
  const def = EXERCISES[id];
  const step = def.unit === 'seconds' ? 5 : 1;
  const opt = spec.options.find((x) => x.id === id);
  const base = id === choice.id ? choice.target : opt ? baseTarget(opt, ctx) : def.start;
  const [lo, hi] = targetRange(def, base, ceilingOf(opt, ctx, base));
  const done = last.sets.filter((x) => x.status === 'done');
  const hitAll = done.length >= last.plannedSets && done.every((x) => x.actual >= last.target);
  const missed = last.sets.filter((x) => x.status === 'skipped' || x.actual <= last.target - 2 * step).length;
  let target = last.target;
  if (hitAll && !ctx.holdProgress) target += step;
  else if (missed >= 2) target -= step;
  if (opt?.fromMax !== undefined && id === choice.id) target = missed >= 2 ? Math.min(target, base) : Math.max(target, base);
  if (target > hi) {
    const harder = spec.vary && !ctx.holdProgress ? def.harder.find((h) => usable(h, ctx, used, true)) : undefined;
    if (harder) return { id: harder, target: EXERCISES[harder].start };
    target = hi;
  }
  if (target < lo) {
    const easier = spec.vary ? def.easier.find((e) => usable(e, ctx, used, false)) : undefined;
    if (easier) return { id: easier, target: EXERCISES[easier].start };
    target = lo;
  }
  return { id, target };
}

function slotsFor(type: DayType, ctx: Ctx): SlotSpec[] {
  const { level, profile } = ctx;
  const balanced = isBalancedTemplate(profile.daysPerWeek);
  const withSkill = level === 4 || (level === 3 && profile.goals.includes('muscleUp'));
  switch (type) {
    case 'pullStrength':
      return [...PULL_STRENGTH[level], ...(balanced ? balanceSlots(type, level) : [])];
    case 'pullVolume': {
      const table = [...PULL_VOLUME[level]];
      if (withSkill) table.splice(2, 0, skillSlot(muscleUpPath({ workouts: ctx.before, maxEntries: ctx.history.maxEntries }, ctx.owned).stage));
      return [...table, ...(balanced ? balanceSlots(type, level) : [])];
    }
    case 'push':
      return [...PUSH[level], ...(balanced ? balanceSlots(type, level) : [])];
    case 'legsCore':
      return [...LEGS_CORE[level]];
    case 'recovery':
      return [...RECOVERY];
    case 'light':
      return [...LIGHT];
    case 'short': {
      const main = (ctx.canPull ? PULL_VOLUME : PUSH)[level][0]!;
      return [{ ...main, minSets: 3, maxSets: 6 }];
    }
    case 'maxTest': {
      const max = ctx.max ?? 0;
      const warm: SlotSpec = level === 0
        ? { key: 'warmup', role: 'warmup', options: [{ id: 'scapular-pull', target: 5 }], sets: 2, minSets: 2, maxSets: 2, restSec: 60, progress: false, vary: false }
        : { key: 'warmup', role: 'warmup', options: [{ id: 'strict-pullup', target: Math.max(1, Math.floor(max * 0.3)) }], sets: 2, minSets: 2, maxSets: 2, restSec: 90, progress: false, vary: false };
      const test: SlotSpec = { key: 'test', role: 'test', options: [{ id: 'strict-pullup', target: Math.max(1, max) }], sets: 1, minSets: 1, maxSets: 1, restSec: 180, progress: false, vary: false };
      return [warm, test, ...PULL_STRENGTH[level].filter((x) => x.role !== 'main')];
    }
  }
}

function buildItems(specs: readonly SlotSpec[], type: DayType, ctx: Ctx): FitItem[] {
  const used = new Set<ExerciseId>();
  const items: FitItem[] = [];
  for (const spec of specs) {
    const isTestSlot = spec.role === 'test' || spec.role === 'warmup';
    const opt = spec.options.find((x) => (isTestSlot ? hasEquipment(EXERCISES[x.id], ctx.owned) : usable(x.id, ctx, used, true)));
    if (!opt) continue;
    const slot = `${type}.${spec.key}`;
    const first: Choice = { id: opt.id, target: baseTarget(opt, ctx) };
    const choice = spec.progress ? progress(spec, slot, first, ctx, used) : first;
    if (!isTestSlot) used.add(choice.id);
    const round5 = (n: number) => Math.round(n / 5) * 5;
    items.push({
      ex: { exerciseId: choice.id, slot, sets: spec.sets, target: choice.target, restSec: spec.restSec, role: spec.role },
      minSets: spec.minSets,
      maxSets: spec.maxSets,
      minRest: Math.max(15, round5(spec.restSec * 0.6)),
      maxRest: round5(spec.restSec * 1.5),
    });
  }
  return items;
}

export function sessionMinutesFor(type: DayType, sessionMinutes: number): number {
  if (type === 'short' || type === 'light') return 10;
  if (type === 'recovery') return Math.min(20, Math.max(10, sessionMinutes));
  return sessionMinutes;
}

function reduce(exercises: PlannedExercise[], setsFactor: number, targetFactor: number): PlannedExercise[] {
  return exercises.map((e) => {
    if (e.role === 'test' || e.role === 'warmup') return e;
    const seconds = EXERCISES[e.exerciseId].unit === 'seconds';
    const t = e.target * targetFactor;
    return {
      ...e,
      sets: Math.max(1, Math.round(e.sets * setsFactor)),
      target: targetFactor < 1 ? Math.max(seconds ? 10 : 1, seconds ? Math.round(t / 5) * 5 : Math.floor(t)) : e.target,
    };
  });
}

export function musclesOf(exercises: readonly PlannedExercise[]): Muscle[] {
  const score = new Map<Muscle, number>();
  for (const e of exercises) {
    EXERCISES[e.exerciseId].muscles.forEach((m, i) => score.set(m, (score.get(m) ?? 0) + e.sets * (i === 0 ? 2 : 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => m);
}

function strengthWithin48h(ctx: Ctx, history: History): boolean {
  return history.workouts.some((w) => (w.type === 'pullStrength' || w.type === 'maxTest') && inRange(w.localDate, addDays(ctx.date, -1), ctx.date));
}

/**
 * The plan for one local date. Pure and deterministic: same profile, history
 * and date → the same workout. On planned rest days the "planned" variant is
 * the optional light session.
 */
export function planDay(profile: Profile, history: History = EMPTY_HISTORY, date: LocalDate, opts: PlanOptions = {}): Workout {
  const variant = opts.variant ?? 'planned';
  const ctx = context(profile, history, date);
  const scheduled = scheduledType(profile.daysPerWeek, date);
  let type: DayType = variant === 'planned' ? scheduled ?? 'light' : variant;
  if ((type === 'pullStrength' || type === 'maxTest') && strengthWithin48h(ctx, history)) type = 'pullVolume';
  let noPullEquipment = false;
  if (!ctx.canPull && PULL_TYPES.includes(type)) {
    // No bar and no rings: strength days become legs/core, volume days push — so
    // the two still alternate in every template. "Short" stays short (push main).
    noPullEquipment = true;
    if (type !== 'short') type = type === 'pullVolume' ? 'push' : 'legsCore';
  }
  const feelingOff = !!opts.feelingOff;
  const training = TRAINING_TYPES.includes(type) && type !== 'maxTest';
  const lighterWeek = training && isLighterWeek(profile.startDate, date);
  const maxTestSuggested =
    variant === 'planned' && type === 'pullStrength' && isMaxTestWeek(profile.startDate, date) &&
    !ctx.painRecently && !ctx.tiredRecently && ctx.returnFactor === 1 && !feelingOff &&
    !history.workouts.some((w) => w.type === 'maxTest' && inRange(w.localDate, addDays(date, -21), date));

  const items = buildItems(slotsFor(type, ctx), type, ctx);
  let exercises = fitDuration(items, sessionMinutesFor(type, profile.sessionMinutes));
  const returning = training && ctx.returnFactor < 1;
  if (training || feelingOff) {
    const setsFactor = Math.max(FACTORS.floor, (lighterWeek ? FACTORS.lighterWeek : 1) * (returning ? ctx.returnFactor : 1) * (feelingOff ? FACTORS.feelingOff : 1));
    const targetFactor = (returning ? 0.9 : 1) * (feelingOff ? 0.9 : 1);
    if (setsFactor < 1 || targetFactor < 1) exercises = reduce(exercises, setsFactor, targetFactor);
  }
  return {
    localDate: date,
    type,
    level: ctx.level,
    exercises,
    estimatedMinutes: estimateMinutes(exercises),
    muscles: musclesOf(exercises),
    flags: {
      lighterWeek,
      returnAfterBreak: returning,
      feelingOff,
      maxTestSuggested,
      noPullEquipment,
      painRecently: ctx.painRecently,
    },
  };
}
