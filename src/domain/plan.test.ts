import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises/catalog';
import {
  START, WEEK1, WEEK3, WEEK4, complete, find, history, logged, makeProfile, maxEntry, recoveryDay, simulate, totalSets,
} from '../test/fixtures';
import { estimateSeconds } from './duration';
import { workingMax } from './level';
import { FACTORS, RESERVE_REPS, lastSlotLog, musclesOf, planDay, returnFactor, sessionMinutesFor, targetRange } from './plan';
import { addDays } from './time';
import type { CompletedWorkout, PlannedExercise, Workout } from './types';

const L2 = history({ maxEntries: [maxEntry(5)] });
const bar = makeProfile();

/** Re-dates a completed workout (to build histories the rotation would not produce). */
function on(w: CompletedWorkout, localDate: string, type = w.type): CompletedWorkout {
  const shift = (iso: string) => `${localDate}${iso.slice(10)}`;
  return { ...w, localDate, type, startedAtUtc: shift(w.startedAtUtc), completedAtUtc: shift(w.completedAtUtc), id: `${w.id}-${localDate}` };
}

/** Adds a legs/core session two days before `next`, so a test history has no 7-day break. */
function filled(h: ReturnType<typeof history>, next: string): ReturnType<typeof history> {
  const legs = on(complete(planDay(bar, L2, addDays(WEEK1, 4))), addDays(next, -2), 'legsCore');
  return { ...h, workouts: [...h.workouts, legs] };
}

function slotLog(slot: string, ex: Omit<PlannedExercise, 'slot'>, actuals: (number | null)[], date = WEEK1, flags: Partial<CompletedWorkout['flags']> = {}, swappedFrom: CompletedWorkout['exercises'][number]['swappedFrom'] = null): CompletedWorkout {
  const plan = planDay(bar, L2, date);
  const base = complete(plan);
  const p: PlannedExercise = { ...ex, slot, sets: actuals.length };
  return {
    ...base,
    type: slot.split('.')[0] as CompletedWorkout['type'],
    flags: { ...base.flags, ...flags },
    exercises: [logged(p, (_, i) => actuals[i] ?? null, base.completedAtUtc, swappedFrom)],
  };
}

describe('planDay — basics', () => {
  it('follows the weekly rotation and offers a light session on planned rest days', () => {
    const types = Array.from({ length: 7 }, (_, i) => planDay(bar, L2, addDays(WEEK1, i)).type);
    expect(types).toEqual(['pullStrength', 'push', 'light', 'pullVolume', 'legsCore', 'light', 'light']);
  });

  it('is deterministic and does not mutate its inputs', () => {
    const h = simulate(bar, L2, START, 14);
    const snapshot = JSON.stringify(h);
    const a = planDay(bar, h, addDays(START, 14));
    const b = planDay(bar, h, addDays(START, 14));
    expect(a).toEqual(b);
    expect(JSON.stringify(h)).toBe(snapshot);
  });

  it('starts at level 0 when no max was given (most conservative)', () => {
    const w = planDay(bar, history(), WEEK1);
    expect(w.level).toBe(0);
    expect(w.exercises[0]!.exerciseId).toBe('negative-pullup');
  });

  it('uses only max entries recorded up to the planned date', () => {
    const h = history({ maxEntries: [maxEntry(5), maxEntry(12, addDays(WEEK1, 3), 'self')] });
    expect(planDay(bar, h, WEEK1).level).toBe(2);
    expect(planDay(bar, h, addDays(WEEK1, 7)).level).toBe(3);
  });

  it('"Train anyway" on a rest day brings the next planned workout forward', () => {
    const saturday = addDays(WEEK1, 5);
    const early = planDay(bar, L2, saturday, { variant: 'early' });
    expect(early.type).toBe('pullStrength');
    expect(early.flags.maxTestSuggested).toBe(false);
    expect(planDay(bar, L2, addDays(WEEK1, 2), { variant: 'early' }).type).toBe('pullVolume');
  });

  it('sizes sessions by type', () => {
    expect(sessionMinutesFor('short', 45)).toBe(10);
    expect(sessionMinutesFor('light', 45)).toBe(10);
    expect(sessionMinutesFor('recovery', 45)).toBe(20);
    expect(sessionMinutesFor('recovery', 10)).toBe(10);
    expect(sessionMinutesFor('push', 45)).toBe(45);
  });

  it('keeps strict sets 2 reps short of the working max (2–3 RIR)', () => {
    for (let max = 1; max <= 20; max++) {
      const profile = makeProfile({ sessionMinutes: 45 });
      let h = simulate(profile, history({ maxEntries: [maxEntry(max)] }), START, 42);
      h = { ...h, workouts: h.workouts.filter((w) => w.type !== 'maxTest') };
      for (const w of [planDay(profile, h, addDays(START, 42)), planDay(profile, h, addDays(START, 45))]) {
        for (const e of w.exercises.filter((x) => x.exerciseId === 'strict-pullup')) {
          expect(e.target, `max ${max}`).toBeLessThanOrEqual(Math.max(1, max - RESERVE_REPS));
        }
      }
    }
  });

  it('lists the main muscles, primary movers first', () => {
    const muscles = musclesOf([
      { exerciseId: 'squat', slot: 'a', sets: 3, target: 10, restSec: 60, role: 'main' },
      { exerciseId: 'plank', slot: 'b', sets: 1, target: 30, restSec: 45, role: 'accessory' },
    ]);
    expect(muscles).toEqual(['quads', 'glutes', 'core', 'shoulders']);
  });

  it('computes target ranges for reps and seconds', () => {
    expect(targetRange(EXERCISES.pushup, 10)).toEqual([5, 25]);
    expect(targetRange(EXERCISES.pushup, 4, 6)).toEqual([2, 6]);
    expect(targetRange(EXERCISES.plank, 30)).toEqual([15, 90]);
    expect(targetRange(EXERCISES.plank, 10)).toEqual([10, 60]);
  });
});

describe('planDay — progression (double progression per slot)', () => {
  it('adds a rep when every set hit its target', () => {
    const w1 = planDay(bar, L2, WEEK1);
    const h = filled(history({ maxEntries: L2.maxEntries, workouts: [complete(w1)] }), addDays(WEEK1, 7));
    const w2 = planDay(bar, h, addDays(WEEK1, 7));
    expect(find(w2, 'row')!.target).toBe(find(w1, 'row')!.target + 1);
    expect(find(w2, 'core')!.target).toBe(find(w1, 'core')!.target + 1);
  });

  it('adds 5 seconds for time-based slots', () => {
    const push = planDay(bar, L2, addDays(WEEK1, 1));
    const plank = find(push, 'core')!;
    expect(EXERCISES[plank.exerciseId].unit).toBe('seconds');
    const h = filled(history({ maxEntries: L2.maxEntries, workouts: [complete(push)] }), addDays(WEEK1, 8));
    expect(find(planDay(bar, h, addDays(WEEK1, 8)), 'core')!.target).toBe(plank.target + 5);
  });

  it('steps back one rep when two or more sets were missed by 2+ or skipped', () => {
    const row: Omit<PlannedExercise, 'slot'> = { exerciseId: 'australian-row', sets: 3, target: 8, restSec: 75, role: 'accessory' };
    for (const actuals of [[8, 5, 5], [8, null, null], [6, 6, 8]]) {
      const h = filled(history({ maxEntries: L2.maxEntries, workouts: [slotLog('pullStrength.row', row, actuals)] }), addDays(WEEK1, 7));
      expect(find(planDay(bar, h, addDays(WEEK1, 7)), 'row')!.target, String(actuals)).toBe(7);
    }
    const h = filled(history({ maxEntries: L2.maxEntries, workouts: [slotLog('pullStrength.row', row, [8, 7, 7])] }), addDays(WEEK1, 7));
    expect(find(planDay(bar, h, addDays(WEEK1, 7)), 'row')!.target).toBe(8);
  });

  it('moves to the next harder variation at the top of the range', () => {
    const push: Omit<PlannedExercise, 'slot'> = { exerciseId: 'pushup', sets: 4, target: 25, restSec: 90, role: 'main' };
    const h = filled(history({ maxEntries: L2.maxEntries, workouts: [slotLog('push.main', push, [25, 25, 25, 25])] }), addDays(WEEK1, 8));
    const next = planDay(bar, h, addDays(WEEK1, 8));
    expect(next.exercises[0]).toMatchObject({ exerciseId: 'diamond-pushup', target: EXERCISES['diamond-pushup'].start });
    expect(next.exercises.filter((e) => e.exerciseId === 'diamond-pushup')).toHaveLength(1);

    // …and keeps progressing on that variation afterwards.
    const after = filled(history({ ...h, workouts: [...h.workouts, complete(next)] }), addDays(WEEK1, 15));
    expect(planDay(bar, after, addDays(WEEK1, 15)).exercises[0]).toMatchObject({ exerciseId: 'diamond-pushup', target: 7 });
  });

  it('caps the target when no harder variation fits the level', () => {
    const push: Omit<PlannedExercise, 'slot'> = { exerciseId: 'pushup', sets: 3, target: 15, restSec: 90, role: 'main' };
    const l1 = filled(history({ maxEntries: [maxEntry(2)], workouts: [slotLog('push.main', push, [15, 15, 15])] }), addDays(WEEK1, 8));
    expect(targetRange(EXERCISES.pushup, 6)[1]).toBe(15);
    expect(planDay(bar, l1, addDays(WEEK1, 8)).exercises[0]).toMatchObject({ exerciseId: 'pushup', target: 15 });
  });

  it('moves to an easier variation at the bottom of the range', () => {
    const profile = makeProfile({ equipment: ['bar', 'bands'] });
    const band: Omit<PlannedExercise, 'slot'> = { exerciseId: 'band-pullup', sets: 3, target: 2, restSec: 90, role: 'secondary' };
    const h = filled(history({ workouts: [slotLog('pullStrength.assist', band, [null, null, 1])] }), addDays(WEEK1, 7));
    const next = planDay(profile, h, addDays(WEEK1, 7));
    expect(find(next, 'assist')).toMatchObject({ exerciseId: 'australian-row', target: EXERCISES['australian-row'].start });
    expect(next.exercises.filter((e) => e.exerciseId === 'australian-row')).toHaveLength(1);
  });

  it('raises max-based slots with the working max, never above max − 2', () => {
    const w1 = planDay(bar, L2, WEEK1);
    expect(find(w1, 'main')).toMatchObject({ exerciseId: 'strict-pullup', target: 3 });
    const done = filled(history({ maxEntries: L2.maxEntries, workouts: [complete(w1)] }), addDays(WEEK1, 7));
    expect(find(planDay(bar, done, addDays(WEEK1, 7)), 'main')!.target).toBe(3);

    const raised = history({ ...done, maxEntries: [...done.maxEntries, maxEntry(9, addDays(WEEK1, 2), 'self')] });
    expect(find(planDay(bar, raised, addDays(WEEK1, 7)), 'main')!.target).toBe(5);
  });

  it('holds progression the day after a tired / pain / ill recovery day, not after "busy"', () => {
    const w1 = planDay(bar, L2, WEEK1);
    const next = addDays(WEEK1, 7);
    const base = filled(history({ maxEntries: L2.maxEntries, workouts: [complete(w1)] }), next);
    for (const reason of ['tired', 'pain', 'ill'] as const) {
      const h = history({ ...base, recoveryDays: [recoveryDay(addDays(next, -1), reason)] });
      expect(find(planDay(bar, h, next), 'row')!.target, reason).toBe(find(w1, 'row')!.target);
    }
    const busy = history({ ...base, recoveryDays: [recoveryDay(addDays(next, -1), 'busy')] });
    expect(find(planDay(bar, busy, next), 'row')!.target).toBe(find(w1, 'row')!.target + 1);
  });

  it('ignores swapped exercises and deliberately reduced sessions', () => {
    const row: Omit<PlannedExercise, 'slot'> = { exerciseId: 'australian-row', sets: 3, target: 12, restSec: 75, role: 'accessory' };
    const swapped = filled(history({ maxEntries: L2.maxEntries, workouts: [slotLog('pullStrength.row', row, [12, 12, 12], WEEK1, {}, 'scapular-pull')] }), addDays(WEEK1, 7));
    expect(find(planDay(bar, swapped, addDays(WEEK1, 7)), 'row')!.target).toBe(8);

    const normal = slotLog('pullStrength.row', { ...row, target: 10 }, [10, 10, 10], WEEK1);
    const lighter = on(slotLog('pullStrength.row', row, [12, 12, 12], WEEK1, { lighterWeek: true }), addDays(WEEK1, 7));
    expect(lastSlotLog([normal, lighter], 'pullStrength.row')!.target).toBe(10);
    const h = filled(history({ maxEntries: L2.maxEntries, workouts: [normal, lighter] }), addDays(WEEK1, 14));
    expect(find(planDay(bar, h, addDays(WEEK1, 14)), 'row')!.target).toBe(11);
  });
});

describe('planDay — lighter weeks, breaks and "feeling off"', () => {
  const ratio = (a: Workout, b: Workout) =>
    a.exercises.map((e, i) => ({ id: e.exerciseId, sets: e.sets, target: e.target, from: b.exercises[i]! }));

  it('every 4th week keeps the exercises and targets with ~60 % of the sets', () => {
    for (let d = 0; d < 7; d++) {
      const normal = planDay(bar, L2, addDays(WEEK1, d));
      const lighter = planDay(bar, L2, addDays(WEEK3, d));
      const training = normal.type !== 'light';
      expect(lighter.flags.lighterWeek).toBe(training);
      for (const r of ratio(lighter, normal)) {
        expect(r.id).toBe(r.from.exerciseId);
        expect(r.target).toBe(r.from.target);
        expect(r.sets).toBe(training ? Math.max(1, Math.round(r.from.sets * FACTORS.lighterWeek)) : r.from.sets);
      }
    }
  });

  it('does not shrink recovery days in a lighter week', () => {
    const seven = makeProfile({ daysPerWeek: 7 });
    const friday = 4;
    expect(planDay(seven, L2, addDays(WEEK3, friday))).toEqual({ ...planDay(seven, L2, addDays(WEEK1, friday)), localDate: addDays(WEEK3, friday) });
  });

  it('comes back gradually after 7+ days off: 70 % → 85 % → 100 %, no guilt, no catch-up', () => {
    const legs = complete(planDay(bar, L2, addDays(START, 4)));
    const h1 = history({ maxEntries: L2.maxEntries, workouts: [legs] });
    const thursday = addDays(WEEK1, 10);
    expect(returnFactor(h1, thursday)).toBe(FACTORS.returnFirst);
    const back = planDay(bar, h1, thursday);
    const fresh = planDay(bar, L2, thursday);
    expect(back.flags.returnAfterBreak).toBe(true);
    for (const r of ratio(back, fresh)) {
      expect(r.id).toBe(r.from.exerciseId);
      expect(r.sets).toBe(Math.max(1, Math.round(r.from.sets * FACTORS.returnFirst)));
      expect(r.target).toBe(Math.max(1, Math.floor(r.from.target * 0.9)));
    }
    expect(totalSets(back)).toBeLessThan(totalSets(fresh));

    const h2 = history({ ...h1, workouts: [legs, complete(back)] });
    expect(returnFactor(h2, addDays(thursday, 1))).toBe(FACTORS.returnSecond);
    expect(planDay(bar, h2, addDays(thursday, 1)).flags.returnAfterBreak).toBe(true);
    const h3 = history({ ...h2, workouts: [...h2.workouts, complete(planDay(bar, h2, addDays(thursday, 1)))] });
    expect(returnFactor(h3, addDays(thursday, 4))).toBe(1);
    expect(planDay(bar, h3, addDays(thursday, 4)).flags.returnAfterBreak).toBe(false);
  });

  it('counts only real training for breaks (light/recovery extras do not reset the gap)', () => {
    expect(returnFactor(history(), WEEK1)).toBe(1);
    const legs = complete(planDay(bar, L2, addDays(START, 4)));
    const light = complete(planDay(bar, L2, addDays(WEEK1, 2)));
    expect(light.type).toBe('light');
    expect(returnFactor(history({ workouts: [legs, light] }), addDays(WEEK1, 5))).toBe(FACTORS.returnFirst);
    expect(returnFactor(history({ workouts: [legs] }), addDays(START, 10))).toBe(1);
  });

  it('"Feeling off" takes ~30 % off the sets and 10 % off the targets', () => {
    for (let d = 0; d < 7; d++) {
      const date = addDays(WEEK1, d);
      const normal = planDay(bar, L2, date);
      const off = planDay(bar, L2, date, { feelingOff: true });
      expect(off.flags.feelingOff).toBe(true);
      for (const r of ratio(off, normal)) {
        expect(r.sets).toBe(Math.max(1, Math.round(r.from.sets * FACTORS.feelingOff)));
        const seconds = EXERCISES[r.id].unit === 'seconds';
        expect(r.target).toBe(seconds ? Math.max(10, Math.round((r.from.target * 0.9) / 5) * 5) : Math.max(1, Math.floor(r.from.target * 0.9)));
      }
      expect(estimateSeconds(off.exercises)).toBeLessThan(estimateSeconds(normal.exercises));
    }
  });

  it('never cuts below 40 % when reasons stack', () => {
    const legs = complete(planDay(bar, L2, addDays(START, 4)));
    const h = history({ maxEntries: L2.maxEntries, workouts: [legs] });
    const date = WEEK3; // lighter week, 17 days after the last session
    const stacked = planDay(bar, h, date, { feelingOff: true });
    const normal = planDay(bar, L2, WEEK1);
    expect(stacked.flags).toMatchObject({ lighterWeek: true, returnAfterBreak: true, feelingOff: true });
    stacked.exercises.forEach((e, i) => expect(e.sets).toBe(Math.max(1, Math.round(normal.exercises[i]!.sets * FACTORS.floor))));
  });
});

describe('planDay — max test (every 4 weeks, suggested, never forced)', () => {
  it('is suggested on the strength day of weeks 4, 8, 12…', () => {
    expect(planDay(bar, L2, WEEK4).flags.maxTestSuggested).toBe(true);
    expect(planDay(bar, L2, addDays(WEEK4, 28)).flags.maxTestSuggested).toBe(true);
    expect(planDay(bar, L2, WEEK1).flags.maxTestSuggested).toBe(false);
    expect(planDay(bar, L2, START).flags.maxTestSuggested).toBe(false);
    expect(planDay(bar, L2, addDays(WEEK4, 3)).flags.maxTestSuggested).toBe(false);
    expect(planDay(bar, L2, WEEK4, { variant: 'short' }).flags.maxTestSuggested).toBe(false);
  });

  it('is not suggested with recent pain/illness, tiredness, after a break or when feeling off', () => {
    const cases = {
      pain: history({ ...L2, recoveryDays: [recoveryDay(addDays(WEEK4, -6), 'pain')] }),
      ill: history({ ...L2, recoveryDays: [recoveryDay(addDays(WEEK4, -2), 'ill')] }),
      tired: history({ ...L2, recoveryDays: [recoveryDay(addDays(WEEK4, -2), 'tired')] }),
      break: history({ ...L2, workouts: [complete(planDay(bar, L2, WEEK1))] }),
    };
    for (const [name, h] of Object.entries(cases)) expect(planDay(bar, h, WEEK4).flags.maxTestSuggested, name).toBe(false);
    expect(planDay(bar, L2, WEEK4, { feelingOff: true }).flags.maxTestSuggested).toBe(false);
    const oldPain = history({ ...L2, recoveryDays: [recoveryDay(addDays(WEEK4, -8), 'pain'), recoveryDay(addDays(WEEK4, -4), 'tired')] });
    expect(planDay(bar, oldPain, WEEK4).flags).toMatchObject({ maxTestSuggested: true, painRecently: false });
  });

  it('is not suggested again within 3 weeks of a test', () => {
    const test = complete(planDay(bar, L2, addDays(WEEK4, -14), { variant: 'maxTest' }));
    expect(test.type).toBe('maxTest');
    expect(planDay(bar, history({ ...L2, workouts: [test] }), WEEK4).flags.maxTestSuggested).toBe(false);
  });

  it('builds a test session: warm-up, one test set at the current max, light accessories', () => {
    const w = planDay(bar, L2, WEEK3, { variant: 'maxTest' });
    expect(w.type).toBe('maxTest');
    expect(w.exercises[0]).toMatchObject({ exerciseId: 'strict-pullup', role: 'warmup', target: 1 });
    expect(w.exercises[1]).toMatchObject({ exerciseId: 'strict-pullup', role: 'test', sets: 1, target: 5 });
    expect(w.exercises.slice(2).every((e) => e.role !== 'main')).toBe(true);
    expect(w.flags.lighterWeek).toBe(false);
    const l0 = planDay(bar, history(), WEEK4, { variant: 'maxTest' });
    expect(l0.exercises[0]).toMatchObject({ exerciseId: 'scapular-pull', role: 'warmup' });
    expect(l0.exercises[1]).toMatchObject({ exerciseId: 'strict-pullup', role: 'test', target: 1 });
  });

  it('feeds the test result back into the working max and the level', () => {
    const test = complete(planDay(bar, L2, WEEK4, { variant: 'maxTest' }), (ex) => (ex.role === 'test' ? 9 : ex.target));
    const h = history({ ...L2, workouts: [test] });
    expect(workingMax(h)?.value).toBe(9);
    expect(planDay(bar, h, addDays(WEEK4, 3)).level).toBe(3);
  });
});

describe('planDay — safety guards', () => {
  it('never puts heavy pulling within 48 h of a strength session or test', () => {
    const strength = complete(planDay(bar, L2, WEEK1));
    const sunday = on(strength, addDays(WEEK1, 6));
    const monday = addDays(WEEK1, 7);
    expect(planDay(bar, history({ ...L2, workouts: [sunday] }), monday).type).toBe('pullVolume');
    expect(planDay(bar, history({ ...L2, workouts: [strength] }), addDays(WEEK1, 1), { variant: 'maxTest' }).type).toBe('pullVolume');
    expect(planDay(bar, history({ ...L2, workouts: [strength] }), addDays(WEEK1, 2), { variant: 'maxTest' }).type).toBe('maxTest');
  });

  it('without a bar or rings: strength days become legs/core, volume days push, short stays short', () => {
    const none = makeProfile({ equipment: ['dipBars'] });
    const monday = planDay(none, L2, WEEK1);
    expect(monday).toMatchObject({ type: 'legsCore', flags: { noPullEquipment: true } });
    expect(planDay(none, L2, addDays(WEEK1, 3))).toMatchObject({ type: 'push', flags: { noPullEquipment: true } });
    expect(planDay(none, L2, addDays(WEEK1, 1))).toMatchObject({ type: 'push', flags: { noPullEquipment: false } });
    const short = planDay(none, L2, WEEK1, { variant: 'short' });
    expect(short).toMatchObject({ type: 'short', flags: { noPullEquipment: true } });
    expect(short.exercises[0]!.exerciseId).toBe('parallel-dips');
    expect(planDay(none, L2, WEEK4).flags.maxTestSuggested).toBe(false);
  });

  it('flags recent pain or illness (shown as a gentle note)', () => {
    const h = history({ ...L2, recoveryDays: [recoveryDay(addDays(WEEK1, -3), 'ill')] });
    expect(planDay(bar, h, WEEK1).flags.painRecently).toBe(true);
    expect(planDay(bar, h, addDays(WEEK1, 5)).flags.painRecently).toBe(false);
  });
});

describe('planDay — templates and skill work', () => {
  it('adds small push/legs/core accessories on 2–3 day weeks only', () => {
    const slots = (days: number) => planDay(makeProfile({ daysPerWeek: days, sessionMinutes: 45 }), L2, WEEK1).exercises.map((e) => e.slot);
    expect(slots(3).some((s) => s.includes('.bal-'))).toBe(true);
    expect(slots(2).some((s) => s.includes('.bal-'))).toBe(true);
    expect(slots(4).some((s) => s.includes('.bal-'))).toBe(false);
  });

  it('adds muscle-up skill work at level 4, or level 3 with the muscle-up goal', () => {
    const thursday = addDays(WEEK1, 3);
    const skill = (max: number, goals: Parameters<typeof makeProfile>[0] = {}) =>
      find(planDay(makeProfile({ sessionMinutes: 45, ...goals }), history({ maxEntries: [maxEntry(max)] }), thursday), 'skill');
    expect(skill(15)?.exerciseId).toBe('high-pullup');
    expect(skill(10, { goals: ['muscleUp'] })?.exerciseId).toBe('high-pullup');
    expect(skill(10)).toBeUndefined();
  });

  it('follows the muscle-up path stage', () => {
    const thursday = addDays(WEEK1, 3);
    const profile = makeProfile({ sessionMinutes: 45 });
    const done = (id: PlannedExercise['exerciseId'], reps: number) =>
      slotLog(`pullVolume.x-${id}`, { exerciseId: id, sets: 1, target: reps, restSec: 60, role: 'accessory' }, [reps], START);
    const h = history({ maxEntries: [maxEntry(15)], workouts: [done('pushup', 15), done('high-pullup', 5)] });
    expect(find(planDay(profile, h, thursday), 'skill')?.exerciseId).toBe('straight-bar-dip');
  });

  it('simulated months keep every plan valid', () => {
    for (const days of [2, 4, 6]) {
      const profile = makeProfile({ daysPerWeek: days, equipment: ['bar', 'dipBars'] });
      const h = simulate(profile, history({ maxEntries: [maxEntry(3)] }), START, 16 * 7, (ex) => ex.target + (ex.role === 'test' ? 1 : 0), { takeTests: true });
      expect(h.workouts.filter((w) => w.type === 'maxTest')).toHaveLength(3);
      expect(workingMax(h)!.value).toBeGreaterThan(3);
      for (const w of h.workouts) {
        for (const e of w.exercises) {
          expect(e.sets.length).toBeGreaterThan(0);
          expect(e.target).toBeGreaterThan(0);
          expect(EXERCISES[e.exerciseId].optional).toBeUndefined();
        }
        const ids = w.exercises.filter((e) => e.role !== 'test' && e.role !== 'warmup').map((e) => e.exerciseId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
