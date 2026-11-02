import { describe, expect, it } from 'vitest';
import { WEEK1, history, makeProfile, maxEntry } from '../test/fixtures';
import { buildSession, lastSlotLog, planDay } from './plan';
import {
  adjustRest, completeSet, currentExercise, doneSetCount, elapsedSec, endRest, finishSession, hasStarted, holdElapsedSec,
  isFinished, pause, progressOf, replacePlan, restLeftSec, resume, skipSet, startHold, startSession, stopHold, swapExercise,
  swapOptions, toggleWarmup,
} from './session';
import { totalsOf } from './stats';
import type { ActiveSession } from './types';

const T0 = Date.parse('2026-01-12T17:00:00.000Z');
const time = (sec: number) => new Date(T0 + sec * 1000);
const profile = makeProfile();
const h = history({ maxEntries: [maxEntry(5)] });
const plan = planDay(profile, h, WEEK1);
const fresh = () => startSession(plan, { id: 's1', variant: 'planned', now: time(0), timeZone: 'Europe/Istanbul', localDate: WEEK1 });
/** JSON round trip = what IndexedDB / a reload gives back. */
const reload = (s: ActiveSession): ActiveSession => JSON.parse(JSON.stringify(s)) as ActiveSession;

function runAll(s: ActiveSession, t = 0): { s: ActiveSession; t: number } {
  let cur = s;
  let now = t;
  while (!isFinished(cur)) {
    const ex = currentExercise(cur)!;
    now += 30;
    cur = completeSet(cur, ex.target, time(now));
    cur = endRest(cur);
  }
  return { s: cur, t: now };
}

describe('workout session', () => {
  it('starts on the first set of the first exercise with an empty log', () => {
    const s = fresh();
    expect(s).toMatchObject({ exIndex: 0, setIndex: 0, phase: 'exercise', pausedSec: 0, feelingOff: false });
    expect(s.log).toHaveLength(plan.exercises.length);
    expect(s.log.every((e) => e.sets.length === 0)).toBe(true);
    expect(hasStarted(s)).toBe(false);
    expect(progressOf(s)).toBe(0);
  });

  it('logs a done set, then rests for the planned time', () => {
    const s = completeSet(fresh(), 4, time(40));
    expect(s.log[0]!.sets).toEqual([{ target: plan.exercises[0]!.target, actual: 4, status: 'done', atUtc: time(40).toISOString() }]);
    expect(s).toMatchObject({ phase: 'rest', setIndex: 1, exIndex: 0, restTotalSec: plan.exercises[0]!.restSec, restCount: 1 });
    expect(restLeftSec(s, time(40))).toBe(plan.exercises[0]!.restSec);
    expect(restLeftSec(s, time(70))).toBe(plan.exercises[0]!.restSec - 30);
    expect(restLeftSec(s, time(10_000))).toBe(0);
    expect(hasStarted(s)).toBe(true);
    // Input is clamped to whole, non-negative numbers.
    expect(completeSet(fresh(), -3, time(1)).log[0]!.sets[0]!.actual).toBe(0);
    expect(completeSet(fresh(), Number.NaN, time(1)).log[0]!.sets[0]!.actual).toBe(0);
  });

  it('ignores input during rest or pause', () => {
    const resting = completeSet(fresh(), 3, time(10));
    expect(completeSet(resting, 3, time(11))).toBe(resting);
    expect(skipSet(resting, time(11))).toBe(resting);
    const paused = pause(fresh(), time(5));
    expect(completeSet(paused, 3, time(6))).toBe(paused);
    expect(pause(paused, time(7))).toBe(paused);
  });

  it('skipping a set moves on without a rest', () => {
    const s = skipSet(fresh(), time(5));
    expect(s.log[0]!.sets[0]).toMatchObject({ status: 'skipped', actual: 0 });
    expect(s.phase).toBe('exercise');
    expect(s.setIndex).toBe(1);
  });

  it('adjusts the rest by ±15 s and ends it at zero', () => {
    const s = completeSet(fresh(), 3, time(0));
    const total = s.restTotalSec;
    const plus = adjustRest(s, 15, time(30));
    expect(restLeftSec(plus, time(30))).toBe(total - 30 + 15);
    expect(plus.restTotalSec).toBe(total + 15);
    const minus = adjustRest(s, -15, time(30));
    expect(restLeftSec(minus, time(30))).toBe(total - 45);
    expect(adjustRest(s, -1000, time(30)).phase).toBe('exercise');
    expect(adjustRest(fresh(), 15, time(0)).phase).toBe('exercise');
    expect(endRest(fresh()).phase).toBe('exercise');
  });

  it('pause freezes the rest timer and the duration; resume continues exactly', () => {
    const s = completeSet(fresh(), 3, time(0));
    const total = s.restTotalSec;
    const paused = pause(s, time(20));
    expect(restLeftSec(paused, time(500))).toBe(total - 20);
    expect(adjustRest(paused, 15, time(500)).pausedRestLeftSec).toBe(total - 5);
    const resumed = resume(paused, time(320));
    expect(resumed.pausedAtUtc).toBeNull();
    expect(resumed.pausedSec).toBe(300);
    expect(restLeftSec(resumed, time(320))).toBe(total - 20);
    expect(elapsedSec(resumed, time(400))).toBe(100);
    expect(elapsedSec(paused, time(400))).toBe(20);
    expect(resume(resumed, time(500))).toBe(resumed);
  });

  it('times holds from absolute instants, paused time excluded', () => {
    const push = buildSession(profile, h, '2026-01-13', 'push');
    let s = startSession(push, { id: 's2', variant: 'planned', now: time(0), timeZone: null, localDate: '2026-01-13' });
    while (currentExercise(s)!.unit !== 'seconds') {
      s = endRest(completeSet(s, currentExercise(s)!.target, time(1)));
    }
    expect(holdElapsedSec(s, time(5))).toBe(0);
    s = startHold(s, time(10));
    expect(startHold(s, time(12))).toBe(s);
    expect(holdElapsedSec(s, time(25))).toBe(15);
    const p = pause(s, time(25));
    expect(holdElapsedSec(p, time(90))).toBe(15);
    const r = resume(p, time(85));
    expect(holdElapsedSec(r, time(90))).toBe(20);
    expect(stopHold(r).holdStartedAtUtc).toBeNull();
    expect(stopHold(stopHold(r))).toEqual(stopHold(r));
    const logged = completeSet(r, holdElapsedSec(r, time(90)), time(90));
    expect(logged.holdStartedAtUtc).toBeNull();
  });

  it('runs through every set to the end; the record has real numbers only', () => {
    const { s, t } = runAll(fresh());
    expect(isFinished(s)).toBe(true);
    expect(currentExercise(s)).toBeNull();
    expect(progressOf(s)).toBe(1);
    const done = finishSession(s, time(t + 5));
    expect(done).toMatchObject({ id: 's1', type: plan.type, localDate: WEEK1, timeZone: 'Europe/Istanbul', finishedEarly: false, mood: null, note: '' });
    expect(done.durationSec).toBe(t + 5);
    const totals = totalsOf(done);
    expect(totals.setsDone).toBe(plan.exercises.reduce((n, e) => n + e.sets, 0));
    expect(totals.setsPlanned).toBe(totals.setsDone);
    expect(doneSetCount(s)).toBe(totals.setsDone);
    // No rest after the very last set.
    expect(s.phase).toBe('exercise');
  });

  it('finishing early keeps only the logged sets and does not count unreached sets as misses', () => {
    let s = completeSet(fresh(), plan.exercises[0]!.target, time(10));
    s = endRest(s);
    const done = finishSession(s, time(60));
    expect(done.finishedEarly).toBe(true);
    expect(done.exercises[0]!.sets).toHaveLength(1);
    expect(done.exercises.slice(1).every((e) => e.sets.length === 0)).toBe(true);
    expect(lastSlotLog([done], plan.exercises[1]!.slot)).toBeNull();
  });

  it('survives a reload at any point (plain JSON, timers as instants)', () => {
    let s = fresh();
    let t = 0;
    for (let i = 0; i < 6; i++) {
      t += 25;
      s = reload(completeSet(s, currentExercise(s)!.target, time(t)));
      expect(restLeftSec(s, time(t + 10))).toBe(Math.max(0, s.restTotalSec - 10));
      s = reload(endRest(s));
    }
    expect(doneSetCount(s)).toBe(6);
  });

  it('swaps an exercise before its first set, and back again', () => {
    // With a box, strict pull-ups can be swapped for feet-assisted pull-ups or negatives.
    const boxProfile = makeProfile({ equipment: ['bar', 'box'] });
    const s = fresh();
    expect(swapOptions(s, profile.equipment)).toEqual([]);
    const options = swapOptions(s, boxProfile.equipment);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(2);
    expect(options).not.toContain(s.log[0]!.exerciseId);
    const swapped = swapExercise(s, options[0]!);
    expect(swapped.log[0]).toMatchObject({ exerciseId: options[0], swappedFrom: plan.exercises[0]!.exerciseId, sets: [] });
    expect(swapOptions(swapped, boxProfile.equipment)[0]).toBe(plan.exercises[0]!.exerciseId);
    const back = swapExercise(swapped, plan.exercises[0]!.exerciseId);
    expect(back.log[0]).toEqual(s.log[0]);
    // Not once a set of it is logged.
    const started = completeSet(s, 3, time(5));
    expect(swapOptions(endRest(started), boxProfile.equipment)).toEqual([]);
    expect(swapExercise(endRest(started), options[0]!)).toEqual(endRest(started));
  });

  it('strict swaps keep the planned (reserve-safe) target; beginners are not offered negatives', () => {
    const l3 = history({ maxEntries: [maxEntry(3)] });
    const strength = buildSession(profile, l3, WEEK1, 'pullStrength');
    expect(strength.exercises[0]).toMatchObject({ exerciseId: 'strict-pullup', target: 1 });
    const start = (w: typeof strength) => startSession(w, { id: 's3', variant: 'planned', now: time(0), timeZone: 'UTC', localDate: WEEK1 });
    const asChin = swapExercise({ ...start(strength), log: start(strength).log.filter((e) => e.exerciseId !== 'chin-up') }, 'chin-up');
    expect(asChin.log[0]).toMatchObject({ exerciseId: 'chin-up', target: 1 });

    const everything = makeProfile({ equipment: ['bar', 'bands', 'box'] });
    const beginner = buildSession(everything, history(), WEEK1, 'pullStrength');
    expect(beginner.level).toBe(0);
    const s = start(beginner);
    for (let i = 0; i < s.log.length; i++) {
      for (const id of swapOptions({ ...s, exIndex: i }, everything.equipment)) expect(id, `slot ${i}`).not.toBe('negative-pullup');
    }
  });

  it('never offers an exercise that needs missing equipment or is already in the session', () => {
    const s = fresh();
    const inSession = new Set(s.log.map((e) => e.exerciseId));
    for (let i = 0; i < s.log.length; i++) {
      for (const id of swapOptions({ ...s, exIndex: i }, ['bar'])) expect(inSession.has(id), id).toBe(false);
    }
  });

  it('replaces the plan only before the first set ("Feeling off")', () => {
    const lighter = planDay(profile, h, WEEK1, { feelingOff: true });
    const s = replacePlan(toggleWarmup(fresh(), 2), lighter);
    expect(s.feelingOff).toBe(true);
    expect(s.warmupDone).toEqual([2]);
    expect(s.log.map((e) => e.plannedSets)).toEqual(lighter.exercises.map((e) => e.sets));
    expect(finishSession(s, time(5)).flags.feelingOff).toBe(true);
    const started = skipSet(fresh(), time(1));
    expect(replacePlan(started, lighter)).toBe(started);
  });

  it('toggles warm-up items', () => {
    const s = toggleWarmup(toggleWarmup(toggleWarmup(fresh(), 3), 1), 3);
    expect(s.warmupDone).toEqual([1]);
  });
});
