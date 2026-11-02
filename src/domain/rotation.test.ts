/**
 * The weekly scheduler as a state machine (DECISIONS D54–D60): every transition
 * spelled out and tested for 2–7 active days, plus property tests over random
 * months (never stuck, every rotation completes, deterministic after reload).
 */
import { describe, expect, it } from 'vitest';
import { START, history, makeProfile, maxEntry, recoveryDay, workoutOf } from '../test/fixtures';
import type { History } from './history';
import { planDay } from './plan';
import { rhythmWeeks } from './progress';
import {
  ROTATION_RULES, checkpointFor, close, dayOf, enter, factsByDay, initialRotation, remapIndex, rotationAt, rotationOf, scheduleOn, scheduleRange, type DaySchedule,
} from './rotation';
import { ROTATIONS, WEEK_SLOTS, planTemplate, weekTargets, withRhythm } from './schedule';
import { addDays, weekdayIndex, type LocalDate } from './time';
import { DAYS_PER_WEEK, type DayType, type Profile, type RotationState } from './types';

type Act = 'train' | 'recovery' | 'rest' | 'nothing';
const PULL: readonly DayType[] = ['pullStrength', 'pullVolume', 'maxTest'];
const NO_FACT = { trained: false, recovery: false, rest: false };
const TRAINED = { ...NO_FACT, trained: true };

/** Logs what the user did on `date` (only the facts matter to the rotation). */
function log(h: History, date: LocalDate, act: Act, type: DayType): History {
  if (act === 'train') return { ...h, workouts: [...h.workouts, workoutOf(date, type, [['australian-row', [8]]])] };
  if (act === 'recovery') return { ...h, workouts: [...h.workouts, workoutOf(date, 'recovery', [['cat-cow', [8]]])] };
  if (act === 'rest') return { ...h, recoveryDays: [...h.recoveryDays, recoveryDay(date, 'busy')] };
  return h;
}

interface Step { date: LocalDate; day: DaySchedule; act: Act; type: DayType | null }

/**
 * Walks `days` days from the start; `decide` picks what the user does with each
 * planned day. `resume` passes the previous day's state as a checkpoint (fast).
 */
function walk(
  profile: Profile | ((i: number) => Profile), days: number, decide: (day: DaySchedule, i: number) => Act, opts: { resume?: boolean; h0?: History } = {},
): { h: History; steps: Step[] } {
  const at = typeof profile === 'function' ? profile : () => profile;
  let h = opts.h0 ?? history();
  let last: RotationState | null = null;
  const steps: Step[] = [];
  for (let i = 0; i < days; i++) {
    const p = at(i);
    const date = addDays(p.startDate, i);
    const day = scheduleOn(p, h, date, opts.resume ? last : null);
    last = day.rotation;
    const act = decide(day, i);
    const type = act === 'train' ? (day.kind === 'training' ? day.type! : day.pending) : act === 'recovery' ? 'recovery' : null;
    steps.push({ date, day, act, type });
    h = log(h, date, act, type ?? 'light');
  }
  return { h, steps };
}

const followPlan = (day: DaySchedule): Act => (day.kind === 'training' ? 'train' : day.kind === 'recovery' ? 'recovery' : 'nothing');
const types = (steps: Step[]) => steps.map((s) => s.day.type);

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random but plausible user: sometimes trains, sometimes rests, sometimes forgets, sometimes trains early. */
function randomUser(seed: number, early = true): (day: DaySchedule) => Act {
  const r = rng(seed);
  return (day) => {
    const x = r();
    if (day.kind === 'training') return x < 0.6 ? 'train' : x < 0.75 ? 'rest' : x < 0.8 ? 'recovery' : 'nothing';
    if (day.kind === 'recovery') return x < 0.5 ? 'recovery' : x < 0.6 && early ? 'train' : x < 0.7 ? 'rest' : 'nothing';
    return early && x < 0.12 ? 'train' : 'nothing';
  };
}

const state = (over: Partial<RotationState> = {}): RotationState => ({ ...initialRotation(makeProfile()), ...over });

describe('rotation transitions (explicit)', () => {
  it('close: what each fact does on each kind of slot', () => {
    const s = state({ trainingRotationIndex: 1, scheduleCursor: 2, completedTrainingSessions: 1 });
    const recovery = { ...NO_FACT, recovery: true };
    const rest = { ...NO_FACT, rest: true };
    const pick = (x: RotationState) => [x.trainingRotationIndex, x.scheduleCursor, x.completedTrainingSessions, x.completedRecoverySessions];
    // [slot, facts] → [rotation index, cursor, training done, recovery done]
    expect(pick(close(s, 'training', TRAINED))).toEqual([2, 3, 2, 0]); // done → next session
    expect(pick(close(s, 'training', undefined))).toEqual([1, 3, 1, 0]); // nothing → session stays pending
    expect(pick(close(s, 'training', rest))).toEqual([1, 3, 1, 0]); // chosen rest → session stays pending
    expect(pick(close(s, 'training', recovery))).toEqual([1, 3, 1, 1]); // recovery instead → still pending
    expect(pick(close(s, 'recovery', recovery))).toEqual([1, 3, 1, 1]); // recovery slot: never moves the rotation
    expect(pick(close(s, 'recovery', undefined))).toEqual([1, 3, 1, 0]); // …and never blocks it
    expect(pick(close(s, 'recovery', TRAINED))).toEqual([2, 3, 2, 0]); // "Train anyway" on a recovery slot
    expect(pick(close(s, 'rest', TRAINED))).toEqual([2, 2, 2, 0]); // session brought forward to a rest day
    expect(pick(close(s, 'rest', undefined))).toEqual([1, 2, 1, 0]);
    expect(close(s, null, TRAINED)).toBe(s); // before the program start nothing counts
    expect(pick(close(state({ trainingRotationIndex: 3 }), 'training', TRAINED))[0]).toBe(0); // wraps around
  });

  it('enter: a new week resets the weekly counters, never the rotation; idempotent', () => {
    const p = makeProfile();
    const s = state({ asOf: addDays(START, 4), trainingRotationIndex: 3, scheduleCursor: 4, completedTrainingSessions: 3 });
    expect(enter(s, p, addDays(START, 4))).toEqual(s);
    const monday = enter(s, p, addDays(START, 7));
    expect(monday).toMatchObject({ weekStart: addDays(START, 7), trainingRotationIndex: 3, scheduleCursor: 0, completedTrainingSessions: 0, completedRecoverySessions: 0 });
    expect(enter(monday, p, addDays(START, 7))).toEqual(monday);
    expect(enter(s, p, addDays(START, -3))).toMatchObject({ trainingRotationIndex: 3, scheduleCursor: 4 }); // before the start
  });

  it('plan: training slot → pending session (rest once the week is done) · recovery · rest · before the start', () => {
    const p = makeProfile({ daysPerWeek: 5 });
    const s = enter(initialRotation(p), p, START);
    expect(dayOf(s, p, START)).toMatchObject({ slot: 'training', kind: 'training', type: 'pullStrength', pending: 'pullStrength', weekDone: false });
    expect(dayOf({ ...s, trainingRotationIndex: 2 }, p, START)).toMatchObject({ type: 'pullVolume' });
    expect(dayOf({ ...s, completedTrainingSessions: 4 }, p, START)).toMatchObject({ slot: 'training', kind: 'rest', type: null, weekDone: true, pending: 'pullStrength' });
    expect(dayOf(s, p, addDays(START, 5))).toMatchObject({ slot: 'recovery', kind: 'recovery', type: 'recovery' });
    expect(dayOf(s, p, addDays(START, 2))).toMatchObject({ slot: 'rest', kind: 'rest', type: null });
    expect(dayOf(s, p, addDays(START, -1))).toMatchObject({ beforeStart: true, kind: 'rest', type: null });
  });

  for (const days of DAYS_PER_WEEK) {
    it(`${days} active days: one full rotation per week, every type in order, then it starts over`, () => {
      const p = makeProfile({ daysPerWeek: days });
      const rotation = rotationOf(days);
      let s = enter(initialRotation(p), p, START);
      const seen: DayType[] = [];
      for (let i = 0; i < rotation.length * 2; i++) {
        seen.push(dayOf(s, p, START).pending);
        s = close(s, 'training', TRAINED);
      }
      expect(seen).toEqual([...rotation, ...rotation]);
      expect(seen.filter((t) => t === 'pullStrength')).toHaveLength(2);
    });
  }
});

describe('weekly rotation per rhythm', () => {
  for (const days of DAYS_PER_WEEK) {
    it(`${days} active days: following the plan repeats the template; targets count training only`, () => {
      const p = makeProfile({ daysPerWeek: days });
      const { steps } = walk(p, 12 * 7, followPlan);
      for (let w = 0; w < 12; w++) expect(types(steps.slice(w * 7, w * 7 + 7)), `week ${w}`).toEqual(planTemplate(days));
      const targets = weekTargets(days);
      for (const step of steps) {
        expect(step.day.rotation.activeDaysPerWeek).toBe(days);
        expect(step.day.rotation.plannedTrainingSessionsPerWeek).toBe(targets.training);
      }
      const sunday = steps[6]!.day.rotation; // start of Sunday: the week's counters
      expect(sunday.completedTrainingSessions).toBe(targets.training);
      expect(sunday.completedRecoverySessions).toBe(days === 7 ? 1 : targets.recovery);
    });
  }

  it('a skipped or rested training day keeps its session for the next training day (every rhythm)', () => {
    const P = 'pullStrength', V = 'pullVolume', U = 'push', L = 'legsCore', R = 'recovery', _ = null;
    const expected: Record<number, [(DayType | null)[], (DayType | null)[]]> = {
      2: [[P, _, _, P, _, _, _], [V, _, _, P, _, _, _]],
      3: [[P, _, P, _, U, _, _], [V, _, P, _, U, _, _]],
      4: [[P, P, _, U, V, _, _], [L, P, _, U, V, _, _]],
      5: [[P, P, _, U, V, R, _], [L, P, _, U, V, R, _]],
      6: [[P, P, U, L, R, V, _], [U, P, U, L, R, V, _]],
      7: [[P, P, U, L, R, V, R], [L, P, U, L, R, V, R]],
    };
    for (const days of DAYS_PER_WEEK) {
      for (const first of ['nothing', 'rest'] as const) {
        const p = makeProfile({ daysPerWeek: days });
        const { steps } = walk(p, 14, (day, i) => (i === 0 ? first : followPlan(day)));
        expect([types(steps.slice(0, 7)), types(steps.slice(7))], `${days} days, ${first}`).toEqual(expected[days]);
      }
    }
  });

  it('recovery slots never hold the rotation, whatever happens on them', () => {
    for (const days of [5, 6, 7]) {
      const p = makeProfile({ daysPerWeek: days });
      // Eight weeks of recovery sessions only: every training slot still offers the strength session…
      const { h, steps } = walk(p, 56, (day) => (day.kind === 'recovery' ? 'recovery' : 'nothing'));
      for (const s of steps) {
        if (s.day.slot === 'training') expect(s.day.type).toBe('pullStrength');
        if (s.day.slot === 'recovery') expect(s.day.type).toBe('recovery');
        expect(s.day.rotation.trainingRotationIndex).toBe(0);
      }
      const beforeSunday = WEEK_SLOTS[days]!.slice(0, 6);
      // Start of the last Sunday: the cursor moved over every active slot, recovery counted.
      expect(steps[55]!.day.rotation.scheduleCursor).toBe(beforeSunday.filter((x) => x !== 'rest').length);
      expect(steps[55]!.day.rotation.completedRecoverySessions).toBe(beforeSunday.filter((x) => x === 'recovery').length);
      // …and the first real session moves it on at once.
      const monday = addDays(START, 56);
      const next = log(h, monday, 'train', 'pullStrength');
      expect(scheduleOn(p, next, addDays(monday, 1)).type).toBe('push');
    }
  });

  it('a week ends at its training target: early sessions count, later slots become rest', () => {
    const p = makeProfile({ daysPerWeek: 4 });
    const plan: Act[] = ['train', 'train', 'train', 'train', 'nothing', 'train', 'nothing', 'train'];
    const { steps } = walk(p, 8, (_, i) => plan[i]!);
    expect(steps.map((s) => s.type)).toEqual(['pullStrength', 'push', 'pullVolume', 'legsCore', null, 'pullStrength', null, 'push']);
    expect(steps[2]!.day).toMatchObject({ kind: 'rest', pending: 'pullVolume' }); // Wednesday "Train anyway"
    expect(steps[4]!.day).toMatchObject({ slot: 'training', kind: 'rest', weekDone: true, type: null });
    expect(steps[5]!.day).toMatchObject({ kind: 'rest', pending: 'pullStrength' });
    expect(steps[7]!.day).toMatchObject({ kind: 'training', type: 'push', rotation: { completedTrainingSessions: 0 } });
  });

  it('a mid-week start is anchored to the weekday (the rest of the week looks like the template)', () => {
    for (const days of DAYS_PER_WEEK) {
      const p = makeProfile({ daysPerWeek: days, startDate: addDays(START, 2) });
      const { steps } = walk(p, 12, followPlan);
      expect(types(steps.slice(0, 5)), `${days} days`).toEqual(planTemplate(days).slice(2));
      expect(types(steps.slice(5, 12)), `${days} days`).toEqual(planTemplate(days));
      const startWeekSlots = WEEK_SLOTS[days]!.slice(2).filter((x) => x === 'training').length;
      expect(steps[0]!.day.rotation.plannedTrainingSessionsPerWeek).toBe(startWeekSlots);
    }
  });
});

describe('rhythm changes', () => {
  it('carry the pending session into the new rotation (explicit cases)', () => {
    const next = (from: number, i: number, to: number) => rotationOf(to)[remapIndex(from, i, to)];
    expect(next(4, 2, 2)).toBe('pullVolume'); // V is in [P, V]: kept
    expect(next(4, 0, 6)).toBe('pullStrength');
    expect(next(4, 3, 6)).toBe('legsCore');
    expect(next(4, 3, 2)).toBe('pullStrength'); // L is gone → continue after V
    expect(next(4, 1, 2)).toBe('pullVolume'); // U is gone → continue after P
    expect(next(4, 3, 3)).toBe('push'); // after V comes P in [P, U, V], but never pull after pull
    expect(next(2, 0, 4)).toBe('legsCore'); // V just done: not P on the next training day
    expect(next(2, 1, 4)).toBe('push'); // P just done: not V on the next training day
    expect(next(3, 0, 4)).toBe('legsCore');
    expect(remapIndex(4, 1, 6)).toBe(1); // U twice in [P, U, L, V, U]: the place after P
    expect(remapIndex(6, 4, 4)).toBe(1);
    for (let i = 0; i < 4; i++) expect(remapIndex(4, i, 5)).toBe(i); // same order, same place
  });

  it('every pair of rhythms: deterministic, in range, pending kept when possible, never pull after pull', () => {
    const isPull = (t: DayType) => t === 'pullStrength' || t === 'pullVolume';
    for (const from of DAYS_PER_WEEK) {
      for (const to of DAYS_PER_WEEK) {
        const a = ROTATIONS[from]!;
        const b = ROTATIONS[to]!;
        for (let i = 0; i < a.length; i++) {
          const j = remapIndex(from, i, to);
          const label = `${from}→${to} at ${i}`;
          expect(j, label).toBeGreaterThanOrEqual(0);
          expect(j, label).toBeLessThan(b.length);
          expect(remapIndex(from, i, to), label).toBe(j);
          if (from === to) expect(j, label).toBe(i);
          const prev = a[(i - 1 + a.length) % a.length]!;
          const clash = from !== to && isPull(prev) && isPull(a[i]!) && !b.every(isPull);
          if (from !== to && isPull(prev) && !b.every(isPull)) expect(isPull(b[j]!), label).toBe(false);
          if (b.includes(a[i]!) && !clash) expect(b[j], label).toBe(a[i]);
        }
      }
    }
  });

  it('round trips: a change and its undo the next day give the same next session', () => {
    for (const from of DAYS_PER_WEEK) {
      for (const to of DAYS_PER_WEEK) {
        for (let i = 0; i < ROTATIONS[from]!.length; i++) {
          const back = remapIndex(to, remapIndex(from, i, to), from);
          const isPullPair = ['pullStrength', 'pullVolume'].includes(ROTATIONS[from]![i]!);
          if (ROTATIONS[to]!.includes(ROTATIONS[from]![i]!) && !isPullPair) expect(ROTATIONS[from]![back], `${from}→${to}→${from} at ${i}`).toBe(ROTATIONS[from]![i]);
        }
      }
    }
  });

  it('a mid-week change applies from that day on and recomputes the week target', () => {
    const base = makeProfile({ daysPerWeek: 4 });
    const wednesday = addDays(START, 2);
    const after = walk(base, 2, followPlan).h; // Mon P, Tue U done → pending V
    const changed = withRhythm(base, 2, wednesday);
    const days = scheduleRange(changed, after, wednesday, addDays(START, 13), wednesday);
    expect(days.map((d) => d.type)).toEqual([null, 'pullVolume', null, null, null, 'pullStrength', null, null, 'pullVolume', null, null, null]);
    expect(days[0]!.rotation).toMatchObject({ activeDaysPerWeek: 2, plannedTrainingSessionsPerWeek: 3, completedTrainingSessions: 2 });
  });

  it('switching back and forth on the same day leaves the schedule exactly as it was', () => {
    const base = makeProfile({ daysPerWeek: 4 });
    const today = addDays(START, 9);
    const { h } = walk(base, 9, randomUser(3));
    const toggled = withRhythm(withRhythm(base, 6, today), 4, today);
    const view = (p: Profile) => scheduleRange(p, h, addDays(today, -9), addDays(today, 14), today).map((d) => [d.date, d.kind, d.type, d.pending]);
    expect(view(toggled)).toEqual(view(base));
  });
});

describe('property: random months', () => {
  for (const days of DAYS_PER_WEEK) {
    it(`${days} active days: never stuck, pending = sessions done, weeks capped, every rotation completes`, { timeout: 20_000 }, () => {
      const rotation = rotationOf(days);
      const target = weekTargets(days).training;
      for (const seed of [1, 2, 3, 4]) {
        const p = makeProfile({ daysPerWeek: days });
        // Seeds 1–2 fold from the start every day, 3–4 resume from the previous day's state.
        const { h, steps } = walk(p, 26 * 7, randomUser(seed * 31 + days), { resume: seed > 2 });
        let trained = 0;
        let thisWeek = 0;
        for (const s of steps) {
          if (weekdayIndex(s.date) === 0) thisWeek = 0;
          expect(s.day.pending, `${s.date}`).toBe(rotation[trained % rotation.length]);
          expect(s.day.rotation.trainingRotationIndex).toBe(trained % rotation.length);
          expect(s.day.rotation.completedTrainingSessions).toBe(thisWeek);
          if (s.day.slot === 'training') {
            expect(s.day.weekDone).toBe(thisWeek >= target);
            expect(s.day.type).toBe(thisWeek >= target ? null : s.day.pending);
          } else {
            expect(s.day.type).toBe(s.day.slot === 'recovery' ? 'recovery' : null);
          }
          if (s.act === 'train') {
            trained++;
            thisWeek++;
          }
        }
        // From any state, training on the next training slots walks through the whole rotation.
        const from = addDays(START, 26 * 7);
        const ahead = scheduleRange(p, h, from, addDays(from, 7 * rotation.length), from).filter((d) => d.kind === 'training');
        const next = ahead.slice(0, rotation.length).map((d) => d.type);
        expect([...next].sort()).toEqual([...rotation].sort());
      }
    });
  }

  it('following the plan (no early sessions) never puts pull sessions on consecutive days', () => {
    for (const days of DAYS_PER_WEEK) {
      for (const seed of [5, 6]) {
        const { steps } = walk(makeProfile({ daysPerWeek: days }), 26 * 7, randomUser(seed + days, false), { resume: true });
        const pulls = steps.filter((s) => s.act === 'train' && PULL.includes(s.type!)).map((s) => s.date);
        for (let i = 1; i < pulls.length; i++) expect(pulls[i], `${days} days`).not.toBe(addDays(pulls[i - 1]!, 1));
      }
    }
  });

  it('random rhythm changes: never stuck, same result with checkpoints, no pull after pull below 2 days', () => {
    for (const seed of [21, 22, 23]) {
      const r = rng(seed);
      let profile = makeProfile({ daysPerWeek: 4 });
      const profiles: Profile[] = [];
      for (let i = 0; i < 20 * 7; i++) {
        if (r() < 0.08) profile = withRhythm(profile, DAYS_PER_WEEK[Math.floor(r() * DAYS_PER_WEEK.length)]!, addDays(START, i));
        profiles.push(profile);
      }
      const final = profiles[profiles.length - 1]!;
      const decide = randomUser(seed, false);
      const a = walk((i) => profiles[i]!, profiles.length, decide, { resume: true });
      // The final profile (with every change) describes the same past: same schedule from scratch.
      const today = addDays(START, profiles.length - 1);
      const replay = scheduleRange(final, a.h, START, today, addDays(today, 1));
      expect(replay.map((d) => [d.date, d.kind, d.type])).toEqual(a.steps.map((s) => [s.date, s.day.kind, s.day.type]));
      const pulls = a.steps.filter((s) => s.act === 'train' && PULL.includes(s.type!));
      for (let i = 1; i < pulls.length; i++) {
        const consecutive = pulls[i]!.date === addDays(pulls[i - 1]!.date, 1);
        if (consecutive) expect(pulls[i]!.day.rotation.rotationDays, pulls[i]!.date).toBe(2);
      }
      const ahead = scheduleRange(final, a.h, addDays(today, 1), addDays(today, 35), addDays(today, 1)).filter((d) => d.kind === 'training');
      expect(new Set(ahead.map((d) => d.type)).size).toBe(new Set(rotationOf(final.daysPerWeek)).size);
    }
  }, 20_000);

  it('with early sessions too, strength never lands within 48 h of strength (planner guard)', () => {
    for (const days of [2, 4, 7]) {
      const p = makeProfile({ daysPerWeek: days });
      let h = history({ maxEntries: [maxEntry(6)] });
      const decide = randomUser(days * 7 + 1);
      const strength: LocalDate[] = [];
      for (let i = 0; i < 12 * 7; i++) {
        const date = addDays(START, i);
        const day = scheduleOn(p, h, date);
        const act = decide(day);
        if (act !== 'train') {
          h = log(h, date, act, 'light');
          continue;
        }
        const w = planDay(p, h, date, day.kind === 'training' ? {} : { variant: 'early' });
        if (w.type === 'pullStrength' || w.type === 'maxTest') {
          expect(strength.some((d) => d >= addDays(date, -1)), `${days} days ${date}`).toBe(false);
          strength.push(date);
        }
        h = log(h, date, 'train', w.type);
      }
      expect(strength.length).toBeGreaterThan(4);
    }
  });
});

describe('checkpoints and reloads', () => {
  const p = makeProfile({ daysPerWeek: 5 });
  const { h } = walk(p, 10 * 7, randomUser(11));
  const facts = factsByDay(h);
  const reload = (s: RotationState) => JSON.parse(JSON.stringify(s)) as RotationState;

  it('resuming from a stored checkpoint equals folding from the start', () => {
    for (const [c, d] of [[3, 3], [10, 30], [29, 30], [0, 69], [45, 69]] as const) {
      const at = addDays(START, c);
      const date = addDays(START, d);
      const checkpoint = reload(rotationAt(p, h, at));
      expect(checkpoint.asOf).toBe(at);
      expect(rotationAt(p, h, date, checkpoint)).toEqual(rotationAt(p, h, date));
      expect(rotationAt(p, h, date, checkpoint, facts)).toEqual(rotationAt(p, h, date));
    }
  });

  it('ignores checkpoints that do not belong to this history, these rules or this program', () => {
    const date = addDays(START, 40);
    const truth = rotationAt(p, h, date);
    const good = reload(rotationAt(p, h, addDays(START, 20)));
    const bad: RotationState[] = [
      { ...good, trainingRotationIndex: (good.trainingRotationIndex + 1) % 4 }, // tampered, digest kept
      { ...good, rules: ROTATION_RULES - 1 },
      { ...good, startDate: addDays(START, 7) },
      { ...good, digest: 'x' },
      { ...good, trainingRotationIndex: 9 },
      reload(rotationAt(p, h, addDays(START, 50))), // ahead of the date
      reload(rotationAt(p, { ...h, workouts: h.workouts.slice(1) }, addDays(START, 20))), // other history
      reload(rotationAt(withRhythm(p, 3, addDays(START, 14)), h, addDays(START, 20))), // other rhythm
    ];
    for (const [i, cp] of bad.entries()) expect(rotationAt(p, h, date, cp), `case ${i}`).toEqual(truth);
  });

  it('the schedule after a reload is the schedule before it (checkpoint from yesterday or today)', () => {
    for (const d of [8, 23, 47, 69]) {
      const today = addDays(START, d);
      const fresh = scheduleRange(p, h, addDays(today, -6), addDays(today, 7), today);
      for (const stored of [null, checkpointFor(p, h, today, null, null), checkpointFor(p, h, addDays(today, -1), null, null)]) {
        const cp = stored && reload(stored);
        expect(scheduleRange(p, h, addDays(today, -6), addDays(today, 7), today, cp)).toEqual(fresh);
        expect(scheduleOn(p, h, today, cp)).toEqual(scheduleOn(p, h, today));
      }
    }
  });

  it('an unfinished session keeps its start day open', () => {
    const today = addDays(START, 30);
    expect(checkpointFor(p, h, today, null, null).asOf).toBe(today);
    expect(checkpointFor(p, h, today, { localDate: addDays(today, -1) }, null).asOf).toBe(addDays(today, -1));
    expect(checkpointFor(p, h, addDays(START, -3), null, null).asOf).toBe(START);
  });

  it('only training counts toward the weekly target (7 active days = 5 training + 2 recovery)', () => {
    const seven = makeProfile({ daysPerWeek: 7 });
    const full = walk(seven, 7, followPlan).h;
    const fourAndRecovery = walk(seven, 7, (day, i) => (i === 5 ? 'nothing' : followPlan(day))).h;
    const next = addDays(START, 7);
    expect(rhythmWeeks(seven, full, next, 2)[0]).toMatchObject({ planned: 5, done: 5, recoveryPlanned: 2, recoveryDone: 2, status: 'onPlan' });
    expect(rhythmWeeks(seven, fourAndRecovery, next, 2)[0]).toMatchObject({ planned: 5, done: 4, recoveryDone: 2, status: 'partial' });
    expect(scheduleOn(seven, full, addDays(START, 6)).rotation).toMatchObject({ activeDaysPerWeek: 7, plannedTrainingSessionsPerWeek: 5, completedTrainingSessions: 5 });
  });
});
