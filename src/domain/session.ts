import { EXERCISES, hasEquipment } from '../data/exercises/catalog';
import type { LocalDate } from './time';
import type { ActiveSession, CompletedWorkout, Equipment, ExerciseId, LoggedExercise, LoggedSet, PlannedExercise, SessionVariant, Workout } from './types';

/**
 * The running workout as a pure state machine. Every transition returns a new
 * plain-JSON session that the app persists immediately (after every set), so a
 * reload or a closed tab restores the exact state. Timers are stored as
 * absolute UTC instants, never as ticking counters.
 */

export interface SessionStart {
  id: string;
  variant: SessionVariant;
  now: Date;
  timeZone: string | null;
  localDate: LocalDate;
}

const at = (ms: number) => new Date(ms).toISOString();
const msOf = (iso: string) => Date.parse(iso);

function toLog(ex: PlannedExercise): LoggedExercise {
  return {
    exerciseId: ex.exerciseId,
    slot: ex.slot,
    unit: EXERCISES[ex.exerciseId].unit,
    role: ex.role,
    target: ex.target,
    plannedSets: ex.sets,
    restSec: ex.restSec,
    sets: [],
    swappedFrom: null,
  };
}

export function startSession(plan: Workout, start: SessionStart): ActiveSession {
  return {
    id: start.id,
    variant: start.variant,
    plan,
    startedAtUtc: start.now.toISOString(),
    localDate: start.localDate,
    timeZone: start.timeZone,
    exIndex: 0,
    setIndex: 0,
    phase: 'exercise',
    restEndsAtUtc: null,
    restTotalSec: 0,
    pausedAtUtc: null,
    pausedRestLeftSec: null,
    pausedSec: 0,
    holdStartedAtUtc: null,
    log: plan.exercises.map(toLog),
    feelingOff: plan.flags.feelingOff,
    restCount: 0,
    warmupDone: [],
  };
}

export function currentExercise(s: ActiveSession): LoggedExercise | null {
  return s.log[s.exIndex] ?? null;
}

export function isFinished(s: ActiveSession): boolean {
  return s.exIndex >= s.log.length;
}

/** Any set logged (done or skipped)? Before that, the plan may still be replaced. */
export function hasStarted(s: ActiveSession): boolean {
  return s.log.some((e) => e.sets.length > 0);
}

export function doneSetCount(s: Pick<ActiveSession, 'log'>): number {
  return s.log.reduce((n, e) => n + e.sets.filter((x) => x.status === 'done').length, 0);
}

/** 0…1 share of planned sets already logged. */
export function progressOf(s: ActiveSession): number {
  const planned = s.log.reduce((n, e) => n + e.plannedSets, 0);
  const logged = s.log.reduce((n, e) => n + Math.min(e.sets.length, e.plannedSets), 0);
  return planned === 0 ? 0 : logged / planned;
}

function pointerAfter(s: ActiveSession): Pick<ActiveSession, 'exIndex' | 'setIndex'> {
  for (let i = s.exIndex; i < s.log.length; i++) {
    const e = s.log[i]!;
    if (e.sets.length < e.plannedSets) return { exIndex: i, setIndex: e.sets.length };
  }
  return { exIndex: s.log.length, setIndex: 0 };
}

function logSet(s: ActiveSession, set: LoggedSet): ActiveSession {
  const log = s.log.map((e, i) => (i === s.exIndex ? { ...e, sets: [...e.sets, set] } : e));
  const next: ActiveSession = { ...s, log, holdStartedAtUtc: null };
  return { ...next, ...pointerAfter(next) };
}

const blocked = (s: ActiveSession) => s.pausedAtUtc !== null || s.phase !== 'exercise' || isFinished(s);

/** Logs the current set as done and starts the rest (none after the very last set). */
export function completeSet(s: ActiveSession, actual: number, now: Date): ActiveSession {
  const ex = currentExercise(s);
  if (!ex || blocked(s)) return s;
  const value = Math.max(0, Math.round(Number.isFinite(actual) ? actual : 0));
  const next = logSet(s, { target: ex.target, actual: value, status: 'done', atUtc: now.toISOString() });
  if (isFinished(next) || ex.restSec <= 0) return next;
  return {
    ...next,
    phase: 'rest',
    restEndsAtUtc: at(now.getTime() + ex.restSec * 1000),
    restTotalSec: ex.restSec,
    restCount: s.restCount + 1,
  };
}

/** Logs the current set as skipped. Nothing was done, so no rest follows. */
export function skipSet(s: ActiveSession, now: Date): ActiveSession {
  const ex = currentExercise(s);
  if (!ex || blocked(s)) return s;
  return logSet(s, { target: ex.target, actual: 0, status: 'skipped', atUtc: now.toISOString() });
}

export function restLeftSec(s: ActiveSession, now: Date): number {
  if (s.phase !== 'rest') return 0;
  if (s.pausedRestLeftSec !== null) return s.pausedRestLeftSec;
  if (!s.restEndsAtUtc) return 0;
  return Math.max(0, Math.ceil((msOf(s.restEndsAtUtc) - now.getTime()) / 1000));
}

export function endRest(s: ActiveSession): ActiveSession {
  if (s.phase !== 'rest') return s;
  return { ...s, phase: 'exercise', restEndsAtUtc: null, restTotalSec: 0, pausedRestLeftSec: null };
}

/** −15 / +15 s. The ring keeps its position: the total changes with the time left. */
export function adjustRest(s: ActiveSession, deltaSec: number, now: Date): ActiveSession {
  if (s.phase !== 'rest') return s;
  const left = restLeftSec(s, now);
  const newLeft = Math.max(0, left + deltaSec);
  if (newLeft === 0) return endRest(s);
  const total = Math.max(newLeft, s.restTotalSec - left + newLeft);
  if (s.pausedAtUtc !== null) return { ...s, pausedRestLeftSec: newLeft, restTotalSec: total };
  return { ...s, restEndsAtUtc: at(now.getTime() + newLeft * 1000), restTotalSec: total };
}

export function pause(s: ActiveSession, now: Date): ActiveSession {
  if (s.pausedAtUtc !== null) return s;
  return { ...s, pausedAtUtc: now.toISOString(), pausedRestLeftSec: s.phase === 'rest' ? restLeftSec(s, now) : null };
}

export function resume(s: ActiveSession, now: Date): ActiveSession {
  if (s.pausedAtUtc === null) return s;
  const pausedMs = Math.max(0, now.getTime() - msOf(s.pausedAtUtc));
  return {
    ...s,
    pausedAtUtc: null,
    pausedSec: s.pausedSec + Math.round(pausedMs / 1000),
    restEndsAtUtc: s.phase === 'rest' && s.pausedRestLeftSec !== null ? at(now.getTime() + s.pausedRestLeftSec * 1000) : s.restEndsAtUtc,
    pausedRestLeftSec: null,
    holdStartedAtUtc: s.holdStartedAtUtc ? at(msOf(s.holdStartedAtUtc) + pausedMs) : null,
  };
}

/** Time-based exercises: start/stop timer instead of a rep stepper. */
export function startHold(s: ActiveSession, now: Date): ActiveSession {
  if (blocked(s) || s.holdStartedAtUtc) return s;
  return { ...s, holdStartedAtUtc: now.toISOString() };
}

export function holdElapsedSec(s: ActiveSession, now: Date): number {
  if (!s.holdStartedAtUtc) return 0;
  const end = s.pausedAtUtc ? msOf(s.pausedAtUtc) : now.getTime();
  return Math.max(0, Math.floor((end - msOf(s.holdStartedAtUtc)) / 1000));
}

export function stopHold(s: ActiveSession): ActiveSession {
  return s.holdStartedAtUtc ? { ...s, holdStartedAtUtc: null } : s;
}

/**
 * "Swap exercise" offers 1–2 equivalent alternatives the user has the equipment
 * for (plus the original, if already swapped), never something already in this session.
 */
export function swapOptions(s: ActiveSession, owned: readonly Equipment[]): ExerciseId[] {
  const planned = s.plan.exercises[s.exIndex];
  const cur = currentExercise(s);
  if (!planned || !cur || cur.sets.length > 0) return [];
  const inSession = new Set(s.log.filter((_, i) => i !== s.exIndex).map((e) => e.exerciseId));
  const candidates = [planned.exerciseId, ...EXERCISES[planned.exerciseId].alternatives];
  return [...new Set(candidates)]
    .filter((id) => id !== cur.exerciseId && !inSession.has(id) && hasEquipment(EXERCISES[id], owned))
    .slice(0, 2);
}

export function swapExercise(s: ActiveSession, id: ExerciseId): ActiveSession {
  const planned = s.plan.exercises[s.exIndex];
  const cur = currentExercise(s);
  if (!planned || !cur || cur.sets.length > 0 || blocked(s)) return s;
  const entry: LoggedExercise = id === planned.exerciseId
    ? toLog(planned)
    : { ...toLog(planned), exerciseId: id, unit: EXERCISES[id].unit, target: EXERCISES[id].start, swappedFrom: planned.exerciseId };
  return { ...s, holdStartedAtUtc: null, log: s.log.map((e, i) => (i === s.exIndex ? entry : e)) };
}

/** Before the first set only: swap in another plan (e.g. "Feeling off today? Make it lighter"). */
export function replacePlan(s: ActiveSession, plan: Workout): ActiveSession {
  if (hasStarted(s)) return s;
  return { ...s, plan, log: plan.exercises.map(toLog), exIndex: 0, setIndex: 0, feelingOff: plan.flags.feelingOff, holdStartedAtUtc: null };
}

export function toggleWarmup(s: ActiveSession, item: number): ActiveSession {
  const done = s.warmupDone.includes(item) ? s.warmupDone.filter((x) => x !== item) : [...s.warmupDone, item].sort((a, b) => a - b);
  return { ...s, warmupDone: done };
}

/** Active (not paused) seconds since the start. */
export function elapsedSec(s: ActiveSession, now: Date): number {
  const pausedNow = s.pausedAtUtc ? Math.max(0, now.getTime() - msOf(s.pausedAtUtc)) / 1000 : 0;
  return Math.max(0, Math.round((now.getTime() - msOf(s.startedAtUtc)) / 1000 - s.pausedSec - pausedNow));
}

/**
 * The completed record. Only sets that were actually logged are kept; when a
 * session is finished early the unreached sets are left out (and never count as
 * misses for progression).
 */
export function finishSession(s: ActiveSession, now: Date): CompletedWorkout {
  return {
    id: s.id,
    type: s.plan.type,
    level: s.plan.level,
    startedAtUtc: s.startedAtUtc,
    completedAtUtc: now.toISOString(),
    localDate: s.localDate,
    timeZone: s.timeZone,
    durationSec: elapsedSec(s, now),
    exercises: s.log.map((e) => ({ ...e, sets: [...e.sets] })),
    flags: { ...s.plan.flags, feelingOff: s.feelingOff },
    mood: null,
    note: '',
    finishedEarly: s.log.some((e) => e.sets.length < e.plannedSets),
  };
}
