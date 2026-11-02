/**
 * The weekly scheduler as an explicit state machine (DECISIONS D54–D60).
 *
 * The calendar (schedule.ts) says what kind each day is: training, recovery or
 * rest. The rotation says WHICH training session the next training slot gets.
 * Three transitions, run day by day from the program start:
 *
 *  enter(day)  new week → weekly counters and cursor start at 0; rhythm changed
 *              → the pending session is carried into the new rotation; this
 *              week's training target is recomputed.
 *  plan(day)   training slot → the pending session (or rest once this week's
 *              training sessions are done) · recovery slot → recovery · rest.
 *  close(day)  a real training session → the rotation moves on by one (once per
 *              day) and counts for the week · a recovery session counts as
 *              recovery only · rest or nothing → the pending session waits for
 *              the next training slot. Every active slot advances the cursor.
 *
 * Pure: the same profile and history always give the same state. A stored state
 * is a checkpoint that is used only while its digest matches the history.
 */
import { isTraining, type History } from './history';
import { ROTATIONS, clampDays, daysPerWeekOn, slotOf, slotOn, trainingSlotsInWeek, type ScheduleProfile, type SlotKind } from './schedule';
import { addDays, weekStart, type LocalDate } from './time';
import type { ActiveSession, DayType, RotationState } from './types';

/** Bump when the rules change: stored checkpoints from older rules are ignored. */
export const ROTATION_RULES = 2;

export interface DayFacts {
  /** A real training session was completed (any training type, incl. short and max test). */
  trained: boolean;
  /** A recovery-mobility session was completed. */
  recovery: boolean;
  /** The user chose to rest this day. */
  rest: boolean;
}

export type FactsByDay = ReadonlyMap<LocalDate, DayFacts>;

export function factsByDay(history: Pick<History, 'workouts' | 'recoveryDays'>): Map<LocalDate, DayFacts> {
  const map = new Map<LocalDate, DayFacts>();
  const at = (date: LocalDate): DayFacts => {
    let f = map.get(date);
    if (!f) {
      f = { trained: false, recovery: false, rest: false };
      map.set(date, f);
    }
    return f;
  };
  for (const w of history.workouts) {
    if (isTraining(w)) at(w.localDate).trained = true;
    else if (w.type === 'recovery') at(w.localDate).recovery = true;
  }
  for (const r of history.recoveryDays) at(r.localDate).rest = true;
  return map;
}

export function rotationOf(daysPerWeek: number): readonly DayType[] {
  return ROTATIONS[clampDays(daysPerWeek)]!;
}

const isPull = (t: DayType) => t === 'pullStrength' || t === 'pullVolume';

/**
 * Rhythm change (D58). The pending session keeps its place when the new rotation
 * has it (of two places, the one right after the session just done). Otherwise
 * the new rotation continues after the session just done (or, if it lacks that
 * one, with the next type of the old order it has). Either way a pull session
 * never follows a pull session when the new rotation has other sessions.
 */
export function remapIndex(fromDays: number, index: number, toDays: number): number {
  const from = rotationOf(fromDays);
  const to = rotationOf(toDays);
  const i = index % from.length;
  if (clampDays(fromDays) === clampDays(toDays)) return i;
  const pending = from[i]!;
  const prev = from[(i - 1 + from.length) % from.length]!;
  const ok = (t: DayType) => !isPull(prev) || !isPull(t) || to.every(isPull);
  const own = to.flatMap((t, j) => (t === pending ? [j] : []));
  if (own.length > 0 && ok(pending)) return own.find((j) => to[(j - 1 + to.length) % to.length] === prev) ?? own[0]!;
  const p = to.indexOf(prev);
  const order = p >= 0
    ? to.map((_, k) => (p + 1 + k) % to.length)
    : from.map((_, k) => to.indexOf(from[(i + k) % from.length]!)).filter((j) => j >= 0);
  return order.find((j) => ok(to[j]!)) ?? order[0] ?? 0;
}

/**
 * The state at the start of the program. In a week that starts mid-week the
 * rotation is anchored to the weekday, so the first days look exactly like the
 * full week would have from that day on.
 */
export function initialRotation(profile: ScheduleProfile): RotationState {
  const start = profile.startDate;
  const days = daysPerWeekOn(profile, start);
  const monday = weekStart(start);
  let earlier = 0;
  for (let d = monday; d < start; d = addDays(d, 1)) if (slotOf(days, d) === 'training') earlier++;
  return {
    rules: ROTATION_RULES,
    asOf: start,
    startDate: start,
    weekStart: monday,
    activeDaysPerWeek: days,
    plannedTrainingSessionsPerWeek: trainingSlotsInWeek(profile, start).training,
    scheduleCursor: 0,
    rotationDays: days,
    trainingRotationIndex: earlier % rotationOf(days).length,
    completedTrainingSessions: 0,
    completedRecoverySessions: 0,
    digest: '',
  };
}

/** Transition 1: the start of `date`. Idempotent for the same date and profile. */
export function enter(s: RotationState, profile: ScheduleProfile, date: LocalDate): RotationState {
  if (date < profile.startDate) return { ...s, asOf: date };
  const next: RotationState = { ...s, asOf: date };
  const monday = weekStart(date);
  if (monday !== s.weekStart) {
    next.weekStart = monday;
    next.scheduleCursor = 0;
    next.completedTrainingSessions = 0;
    next.completedRecoverySessions = 0;
  }
  const days = daysPerWeekOn(profile, date);
  if (days !== s.rotationDays) {
    next.trainingRotationIndex = remapIndex(s.rotationDays, s.trainingRotationIndex, days);
    next.rotationDays = days;
  }
  next.activeDaysPerWeek = days;
  next.plannedTrainingSessionsPerWeek = trainingSlotsInWeek(profile, date).training;
  return next;
}

/** Transition 3: the end of a day with its facts. `slot` null = before the start (nothing counts). */
export function close(s: RotationState, slot: SlotKind | null, facts: DayFacts | undefined): RotationState {
  if (slot === null) return s;
  const next: RotationState = { ...s };
  if (facts?.trained) {
    next.trainingRotationIndex = (s.trainingRotationIndex + 1) % rotationOf(s.rotationDays).length;
    next.completedTrainingSessions = s.completedTrainingSessions + 1;
  }
  if (facts?.recovery) next.completedRecoverySessions = s.completedRecoverySessions + 1;
  if (slot !== 'rest') next.scheduleCursor = s.scheduleCursor + 1;
  return next;
}

export interface DaySchedule {
  date: LocalDate;
  /** Before the program started: nothing is planned. */
  beforeStart: boolean;
  /** Calendar slot for the rhythm of that day. */
  slot: SlotKind;
  /** What the day asks for: a training slot is rest once this week's training is done. */
  kind: SlotKind;
  /** This week's training sessions are already done (a training slot became rest). */
  weekDone: boolean;
  /** Planned session: the pending training type, 'recovery', or null on rest days. */
  type: DayType | null;
  /** The next training session in the rotation (what "Train anyway" brings forward). */
  pending: DayType;
  /** Rotation state at the start of the day. */
  rotation: RotationState;
}

/** Transition 2: what `date` asks for, given the state at its start (after `enter`). */
export function dayOf(s: RotationState, profile: ScheduleProfile, date: LocalDate): DaySchedule {
  const rotation = rotationOf(s.rotationDays);
  const pending = rotation[s.trainingRotationIndex % rotation.length]!;
  const slot = slotOn(profile, date);
  const base = { date, pending, rotation: s, weekDone: false };
  if (slot === null) return { ...base, beforeStart: true, slot: 'rest', kind: 'rest', type: null };
  if (slot === 'training') {
    const weekDone = s.completedTrainingSessions >= s.plannedTrainingSessionsPerWeek;
    return weekDone
      ? { ...base, beforeStart: false, slot, kind: 'rest', type: null, weekDone: true }
      : { ...base, beforeStart: false, slot, kind: 'training', type: pending };
  }
  if (slot === 'recovery') return { ...base, beforeStart: false, slot, kind: 'recovery', type: 'recovery' };
  return { ...base, beforeStart: false, slot, kind: 'rest', type: null };
}

/* ── Checkpoints ─────────────────────────────────────────────────────────── */

function fnv1a(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const STATE_FIELDS = [
  'rules', 'asOf', 'startDate', 'weekStart', 'activeDaysPerWeek', 'plannedTrainingSessionsPerWeek', 'scheduleCursor',
  'rotationDays', 'trainingRotationIndex', 'completedTrainingSessions', 'completedRecoverySessions',
] as const satisfies readonly (keyof RotationState)[];

/**
 * Seal of a state at the start of `s.asOf`: everything it depends on (the start
 * date, the rhythm in force up to and including `asOf`, the facts of every program
 * day before `asOf`) plus the state's own fields — so a stale, edited or damaged
 * checkpoint never matches and is simply recomputed.
 */
export function digestOf(s: RotationState, profile: ScheduleProfile, facts: FactsByDay): string {
  const parts: string[] = [`rules${ROTATION_RULES}`, profile.startDate];
  const log = profile.rhythmChanges?.length ? profile.rhythmChanges : [{ from: profile.startDate, daysPerWeek: profile.daysPerWeek }];
  for (const c of log) if (c.from <= s.asOf) parts.push(`${c.from}=${c.daysPerWeek}`);
  const dates = [...facts.keys()].filter((d) => d >= profile.startDate && d < s.asOf).sort();
  for (const d of dates) {
    const f = facts.get(d)!;
    parts.push(`${d}:${f.trained ? 1 : 0}${f.recovery ? 1 : 0}${f.rest ? 1 : 0}`);
  }
  parts.push(STATE_FIELDS.map((k) => String(s[k])).join(','));
  const text = parts.join('|');
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x9747b28c);
}

const sealed = (s: RotationState, profile: ScheduleProfile, facts: FactsByDay): RotationState => ({ ...s, digest: digestOf(s, profile, facts) });

function usableCheckpoint(c: RotationState | null | undefined, profile: ScheduleProfile, facts: FactsByDay, date: LocalDate): c is RotationState {
  return !!c
    && c.rules === ROTATION_RULES
    && c.startDate === profile.startDate
    && c.asOf >= profile.startDate
    && c.asOf <= date
    && c.rotationDays === clampDays(c.rotationDays)
    && c.trainingRotationIndex >= 0
    && c.trainingRotationIndex < rotationOf(c.rotationDays).length
    && c.digest === digestOf(c, profile, facts);
}

/**
 * The rotation state at the start of `date` (after its `enter`). Resumes from
 * `checkpoint` when it is still valid for this history, else folds from the
 * program start; either way the result is the same.
 */
export function rotationAt(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  date: LocalDate,
  checkpoint?: RotationState | null,
  facts: FactsByDay = factsByDay(history),
): RotationState {
  let s = usableCheckpoint(checkpoint, profile, facts, date) ? checkpoint : initialRotation(profile);
  if (date < s.asOf) return sealed({ ...s, asOf: date }, profile, facts);
  for (let d = s.asOf; d < date; d = addDays(d, 1)) {
    s = close(s, slotOn(profile, d), facts.get(d));
    s = enter(s, profile, addDays(d, 1));
  }
  return sealed(enter(s, profile, date), profile, facts);
}

/** The schedule of one day with the real history before it. */
export function scheduleOn(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  date: LocalDate,
  checkpoint?: RotationState | null,
): DaySchedule {
  return dayOf(rotationAt(profile, history, date, checkpoint), profile, date);
}

const hasFacts = (f: DayFacts | undefined): f is DayFacts => !!f && (f.trained || f.recovery || f.rest);

/**
 * Days `from`…`to`. Days before `today` use what really happened. Today uses
 * its facts once there are any; until then (and on every later day) the plan is
 * assumed to be followed, which is how "tomorrow" and the rest of the week are
 * projected.
 */
export function scheduleRange(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  checkpoint?: RotationState | null,
): DaySchedule[] {
  const facts = factsByDay(history);
  const begin = from < today ? from : today;
  let s = rotationAt(profile, history, begin, checkpoint, facts);
  const out: DaySchedule[] = [];
  for (let d = begin; d <= to; d = addDays(d, 1)) {
    if (d !== begin) s = enter(s, profile, d);
    const day = dayOf(s, profile, d);
    if (d >= from) out.push(day);
    const real = facts.get(d);
    const assumed: DayFacts = { trained: day.kind === 'training', recovery: day.kind === 'recovery', rest: false };
    s = close(s, day.beforeStart ? null : day.slot, d < today || (d === today && hasFacts(real)) ? real : assumed);
  }
  return out;
}

/**
 * The last day whose facts are final: yesterday, or the day an unfinished
 * session started on (it is still logged on its start date).
 */
export function closedThrough(today: LocalDate, active: Pick<ActiveSession, 'localDate'> | null): LocalDate {
  return active && active.localDate < today ? active.localDate : today;
}

/** The checkpoint worth storing: the state at the start of the first day that is still open. */
export function checkpointFor(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  today: LocalDate,
  active: Pick<ActiveSession, 'localDate'> | null,
  stored: RotationState | null,
): RotationState {
  const open = closedThrough(today, active);
  return rotationAt(profile, history, open > profile.startDate ? open : profile.startDate, stored);
}

export function sameRotation(a: RotationState | null, b: RotationState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (Object.keys(a) as (keyof RotationState)[]).every((k) => a[k] === b[k]) && Object.keys(a).length === Object.keys(b).length;
}
