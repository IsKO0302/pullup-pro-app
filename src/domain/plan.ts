import { EXERCISES, hasEquipment, type ExerciseDef } from '../data/exercises/catalog';
import { estimateMinutes, fitDuration, type FitItem } from './duration';
import { EMPTY_HISTORY, TRAINING_TYPES, bestOf, isTraining, workoutsBefore, type History } from './history';
import { levelFromMax, workingMax } from './level';
import { muscleUpPath } from './paths';
import { scheduleOn } from './rotation';
import { daysPerWeekOn, isBalancedTemplate, isLighterWeek, isMaxTestWeek } from './schedule';
import { LEGS_CORE, LIGHT, PULL_STRENGTH, PULL_VOLUME, PUSH, RECOVERY, balanceSlots, skillSlot, type SlotOption, type SlotSpec } from './slots';
import { addDays, daysBetween, type LocalDate } from './time';
import type {
  CompletedWorkout, DayType, Equipment, ExerciseId, Level, LoggedExercise, Muscle, PlannedExercise, Profile, RotationState, SessionVariant, Workout,
} from './types';

export type Variant = SessionVariant;

export interface PlanOptions {
  variant?: Variant;
  /** "Feeling off today? Make it lighter" (−30 % volume). */
  feelingOff?: boolean;
  /** Stored rotation checkpoint (only a shortcut: the result is the same without it). */
  rotation?: RotationState | null;
}

export const FACTORS = {
  lighterWeek: 0.6,
  returnFirst: 0.7,
  returnSecond: 0.85,
  feelingOff: 0.7,
  floor: 0.4,
} as const;

const PULL_TYPES: readonly DayType[] = ['pullStrength', 'pullVolume', 'maxTest', 'short'];

/**
 * Strict pull-up work stays at least 2 reps short of the strict max the user has
 * today (2–3 reps in reserve, guardrail 4). Below that there is no strict set
 * with reserve, so the slot falls back to assisted work (DECISIONS D62).
 */
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
  /**
   * The strict max the reserve is checked against: one rep lower after a break or
   * when feeling off, so the reserve also holds on weaker days. Targets still come
   * from the confirmed max (`max`); this only caps them. null = no strict max.
   */
  strictMax: number | null;
  /** Target cut the session applies afterwards (returning / feeling off), 1 = none. */
  targetFactor: number;
  /** Negatives are prescribed only with safe top access and a controlled descent (D61). */
  negativesReady: boolean;
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

/**
 * Negatives start at the top of the bar, so they need a stable box to step up
 * from (never a jump) and a body that can already control a descent: a strict
 * pull-up (level 1+), or a 30 s hang plus 10 scapular pull-ups, or 8 band-assisted
 * pull-ups, or negatives that were already logged.
 */
export function negativesReady(level: Level, owned: readonly Equipment[], before: readonly CompletedWorkout[]): boolean {
  if (!owned.includes('box') || !(owned.includes('bar') || owned.includes('rings'))) return false;
  if (level >= 1) return true;
  const hang = Math.max(bestOf(before, 'dead-hang'), bestOf(before, 'active-hang'));
  return (hang >= 30 && bestOf(before, 'scapular-pull') >= 10) || bestOf(before, 'band-pullup') >= 8 || bestOf(before, 'negative-pullup') >= 1;
}

function context(profile: Profile, history: History, date: LocalDate, feelingOff = false): Ctx {
  const before = workoutsBefore(history, date);
  const wm = workingMax({ workouts: before, maxEntries: history.maxEntries }, date);
  const owned = profile.equipment;
  const recovery = history.recoveryDays;
  const level = levelFromMax(wm?.value ?? 0);
  const factor = returnFactor(history, date);
  const max = wm ? wm.value : null;
  return {
    profile,
    date,
    level,
    max,
    owned,
    canPull: owned.includes('bar') || owned.includes('rings'),
    before,
    history,
    painRecently: recovery.some((r) => (r.reason === 'pain' || r.reason === 'ill') && inRange(r.localDate, addDays(date, -7), date)),
    tiredRecently: recovery.some((r) => r.reason === 'tired' && inRange(r.localDate, addDays(date, -3), date)),
    holdProgress: recovery.some((r) => r.reason !== null && r.reason !== 'busy' && inRange(r.localDate, addDays(date, -1), date)),
    returnFactor: factor,
    strictMax: max === null ? null : Math.max(0, max - (factor < 1 || feelingOff ? 1 : 0)),
    targetFactor: 1,
    negativesReady: negativesReady(level, owned, before),
  };
}

function usable(id: ExerciseId, ctx: Ctx, used: ReadonlySet<ExerciseId>, checkLevel: boolean): boolean {
  const def = EXERCISES[id];
  if (used.has(id) || def.optional || !hasEquipment(def, ctx.owned)) return false;
  if (def.family === 'negative' && !ctx.negativesReady) return false;
  return !checkLevel || (ctx.level >= def.levelRange[0] && ctx.level <= def.levelRange[1]);
}

/** Highest strict pull-up target that still keeps RESERVE_REPS in reserve (≤ 0 = none). */
export function strictLimit(strictMax: number | null): number {
  return strictMax === null ? 0 : strictMax - RESERVE_REPS;
}

const isStrict = (id: ExerciseId) => EXERCISES[id].family === 'pullup';

/** A rep target after the session's target cut (same rounding as `reduce`). */
function cutTarget(target: number, factor: number): number {
  return factor < 1 ? Math.max(1, Math.floor(target * factor)) : target;
}

/**
 * Strict pull-up family work is planned only with reps in reserve — checked on the
 * target the user will actually see, against the (possibly lowered) strict max.
 */
function withReserve(id: ExerciseId, target: number, ctx: Ctx): boolean {
  return !isStrict(id) || (target >= 1 && cutTarget(target, ctx.targetFactor) <= strictLimit(ctx.strictMax));
}

function baseTarget(opt: SlotOption, ctx: Ctx): number {
  const def = EXERCISES[opt.id];
  if (opt.fromMax !== undefined && ctx.max !== null) {
    return Math.min(opt.cap ?? 99, Math.max(1, Math.floor(ctx.max * opt.fromMax)));
  }
  return opt.target ?? def.start;
}

/** Ceiling of a max-based slot: the slot cap, but never closer than RESERVE_REPS to the strict max. */
function ceilingOf(opt: SlotOption | undefined, ctx: Ctx, base: number): number | undefined {
  if (!opt || opt.fromMax === undefined || ctx.strictMax === null) return opt?.cap;
  return Math.min(opt.cap ?? 99, Math.max(base, strictLimit(ctx.strictMax)));
}

export function targetRange(def: ExerciseDef, base: number, cap?: number): [number, number] {
  if (def.unit === 'seconds') {
    return [Math.max(10, Math.round((base * 0.5) / 5) * 5), Math.max(cap ?? Math.max(60, base * 3), base)];
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
    // A slot that was not reached (finished early) carries no information.
    const ex = w.exercises.find((e) => e.slot === slot && e.sets.length > 0);
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
  const [lo, range] = targetRange(def, base, ceilingOf(opt, ctx, base));
  const hi = Math.min(range, def.ceiling ?? range);
  const done = last.sets.filter((x) => x.status === 'done');
  const hitAll = done.length >= last.plannedSets && done.every((x) => x.actual >= last.target);
  const missed = last.sets.filter((x) => x.status === 'skipped' || x.actual <= last.target - 2 * step).length;
  let target = last.target;
  if (hitAll && !ctx.holdProgress) target += step;
  else if (missed >= 2) target -= step;
  if (opt?.fromMax !== undefined && id === choice.id) target = missed >= 2 ? Math.min(target, base) : Math.max(target, base);
  if (target > hi) {
    const harder = spec.vary && !ctx.holdProgress
      ? def.harder.find((h) => usable(h, ctx, used, true) && withReserve(h, firstTarget(h, ctx), ctx))
      : undefined;
    if (harder) return { id: harder, target: firstTarget(harder, ctx) };
    target = hi;
  }
  if (target < lo) {
    const easier = spec.vary ? def.easier.find((e) => usable(e, ctx, used, false)) : undefined;
    if (easier) return { id: easier, target: EXERCISES[easier].start };
    target = lo;
  }
  return safeChoice({ id, target }, choice, ctx);
}

/** First target of a newly introduced variation; strict ones start inside the reserve. */
function firstTarget(id: ExerciseId, ctx: Ctx): number {
  const start = Math.min(EXERCISES[id].start, EXERCISES[id].ceiling ?? 99);
  return isStrict(id) ? Math.min(start, strictLimit(ctx.strictMax)) : start;
}

/** Last line of defence: progression never plans a strict set without reserve. */
function safeChoice(next: Choice, fallback: Choice, ctx: Ctx): Choice {
  if (!isStrict(next.id)) return next;
  const limit = strictLimit(ctx.strictMax);
  if (limit < 1) return fallback;
  return { id: next.id, target: Math.min(next.target, limit) };
}

function slotsFor(type: DayType, ctx: Ctx): SlotSpec[] {
  const { level, profile } = ctx;
  const balanced = isBalancedTemplate(daysPerWeekOn(profile, ctx.date));
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
      // Warm-up singles only with reserve (max 3+); otherwise scapular pulls, so the
      // test itself is the only near-max effort of the day.
      const strictWarm = Math.max(1, Math.floor(max * 0.3));
      const warm: SlotSpec = level === 0 || strictWarm > strictLimit(ctx.strictMax)
        ? { key: 'warmup', role: 'warmup', options: [{ id: 'scapular-pull', target: 5 }], sets: 2, minSets: 2, maxSets: 2, restSec: 60, progress: false, vary: false }
        : { key: 'warmup', role: 'warmup', options: [{ id: 'strict-pullup', target: strictWarm }], sets: 2, minSets: 2, maxSets: 2, restSec: 90, progress: false, vary: false };
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
    const opt = spec.options.find((x) => (isTestSlot
      ? hasEquipment(EXERCISES[x.id], ctx.owned)
      : usable(x.id, ctx, used, true) && withReserve(x.id, baseTarget(x, ctx), ctx)));
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
 * and date → the same workout. The rotation decides the session (rotation.ts);
 * on rest days the "planned" variant is the optional light session and "early"
 * brings the pending training session forward.
 */
export function planDay(profile: Profile, history: History = EMPTY_HISTORY, date: LocalDate, opts: PlanOptions = {}): Workout {
  const variant = opts.variant ?? 'planned';
  const day = scheduleOn(profile, history, date, opts.rotation);
  const type: DayType =
    variant === 'planned' ? day.type ?? 'light'
    : variant === 'early' ? day.pending
    : variant;
  return buildSession(profile, history, date, type, { variant, feelingOff: opts.feelingOff });
}

/**
 * One session of a given type on `date` (slot tables, progression, reductions).
 * Exposed so the slot logic can be tested without the weekly rotation.
 */
export function buildSession(
  profile: Profile,
  history: History,
  date: LocalDate,
  requested: DayType,
  opts: { variant?: Variant; feelingOff?: boolean } = {},
): Workout {
  const variant = opts.variant ?? 'planned';
  const feelingOff = !!opts.feelingOff;
  const ctx = context(profile, history, date, feelingOff);
  let type = requested;
  if ((type === 'pullStrength' || type === 'maxTest') && strengthWithin48h(ctx, history)) type = 'pullVolume';
  let noPullEquipment = false;
  if (!ctx.canPull && PULL_TYPES.includes(type)) {
    // No bar and no rings: strength days become legs/core, volume days push — so
    // the two still alternate in every rotation. "Short" stays short (push main).
    noPullEquipment = true;
    if (type !== 'short') type = type === 'pullVolume' ? 'push' : 'legsCore';
  }
  const training = TRAINING_TYPES.includes(type) && type !== 'maxTest';
  const lighterWeek = training && isLighterWeek(profile.startDate, date);
  const maxTestSuggested =
    variant === 'planned' && type === 'pullStrength' && isMaxTestWeek(profile.startDate, date) &&
    !ctx.painRecently && !ctx.tiredRecently && ctx.returnFactor === 1 && !feelingOff &&
    !history.workouts.some((w) => w.type === 'maxTest' && inRange(w.localDate, addDays(date, -21), date));

  const returning = training && ctx.returnFactor < 1;
  const targetFactor = (returning ? 0.9 : 1) * (feelingOff ? 0.9 : 1);
  const items = buildItems(slotsFor(type, ctx), type, { ...ctx, targetFactor });
  let exercises = fitDuration(items, sessionMinutesFor(type, profile.sessionMinutes));
  if (training || feelingOff) {
    const setsFactor = Math.max(FACTORS.floor, (lighterWeek ? FACTORS.lighterWeek : 1) * (returning ? ctx.returnFactor : 1) * (feelingOff ? FACTORS.feelingOff : 1));
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
