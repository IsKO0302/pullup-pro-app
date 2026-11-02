import { describe, expect, it } from 'vitest';
import { START, WEEK1, complete, history, makeProfile } from '../test/fixtures';
import { bestOf, bestSet, isTraining, workoutsBefore } from './history';
import { planDay } from './plan';
import { addDays } from './time';

const p = makeProfile();

describe('history helpers', () => {
  it('returns workouts strictly before a date, oldest first by start time', () => {
    const a = complete(planDay(p, history(), WEEK1), undefined, 19);
    const b = complete(planDay(p, history(), WEEK1), undefined, 7);
    const c = complete(planDay(p, history(), addDays(WEEK1, 1)));
    const before = workoutsBefore(history({ workouts: [c, a, b] }), addDays(WEEK1, 1));
    expect(before.map((w) => w.startedAtUtc)).toEqual([b.startedAtUtc, a.startedAtUtc]);
  });

  it('knows which sessions count as training', () => {
    expect(isTraining(complete(planDay(p, history(), START)))).toBe(true);
    expect(isTraining(complete(planDay(p, history(), addDays(START, 2))))).toBe(false);
    expect(isTraining(complete(planDay(makeProfile({ daysPerWeek: 7 }), history(), addDays(START, 4))))).toBe(false);
  });

  it('finds the best completed set, ignoring skipped ones', () => {
    const w = complete(planDay(p, history(), START), (ex, i) => (i === 1 ? null : ex.target + i));
    const ex = w.exercises[0]!;
    const expected = Math.max(...ex.sets.map((_, i) => (i === 1 ? 0 : ex.target + i)));
    expect(ex.sets.length).toBeGreaterThanOrEqual(3);
    expect(bestSet(ex)).toBe(expected);
    expect(bestSet({ ...ex, sets: ex.sets.map((s) => ({ ...s, status: 'skipped' as const })) })).toBe(0);
    expect(bestOf([w], ex.exerciseId)).toBe(bestSet(ex));
    expect(bestOf([w], 'muscle-up')).toBe(0);
  });
});
