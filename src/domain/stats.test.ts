import { describe, expect, it } from 'vitest';
import { START, WEEK1, complete, history, logged, makeProfile, maxEntry } from '../test/fixtures';
import { planDay } from './plan';
import { recordsOf, totalsOf } from './stats';
import { addDays } from './time';
import type { CompletedWorkout, ExerciseId, ExerciseRole } from './types';

function workout(date: string, entries: [ExerciseId, (number | null)[], ExerciseRole?][], hour = 18): CompletedWorkout {
  const base = complete(planDay(makeProfile(), history(), date), undefined, hour);
  return {
    ...base,
    id: `w-${date}-${hour}`,
    exercises: entries.map(([id, sets, role], i) =>
      logged({ exerciseId: id, slot: `x.${i}`, sets: sets.length, target: 5, restSec: 60, role: role ?? 'main' }, (_, k) => sets[k] ?? null, base.completedAtUtc)),
  };
}

describe('workout totals', () => {
  it('counts only done sets; reps and seconds separately; pull-ups = strict unassisted variations', () => {
    const w = workout(WEEK1, [
      ['strict-pullup', [5, 4, null]],
      ['chin-up', [6]],
      ['band-pullup', [8, 8]],
      ['negative-pullup', [3]],
      ['plank', [30, 25]],
    ]);
    expect(totalsOf(w)).toEqual({ setsDone: 8, setsPlanned: 9, reps: 34, seconds: 55, pullups: 15, bestStrictSet: 5 });
  });
});

describe('personal records — only real ones', () => {
  it('needs an earlier best of the same exercise to beat', () => {
    const first = workout(WEEK1, [['australian-row', [8, 8]]]);
    expect(recordsOf(first, [first])).toEqual([]);
    const second = workout(addDays(WEEK1, 2), [['australian-row', [10, 9]]]);
    expect(recordsOf(second, [first, second])).toEqual([{ exerciseId: 'australian-row', unit: 'reps', value: 10, previous: 8 }]);
    const equal = workout(addDays(WEEK1, 4), [['australian-row', [10]]]);
    expect(recordsOf(equal, [first, second, equal])).toEqual([]);
  });

  it('compares strict pull-ups with earlier max entries too; variations stay separate', () => {
    const w = workout(WEEK1, [['strict-pullup', [6]], ['chin-up', [9]]]);
    expect(recordsOf(w, [w], [maxEntry(5, START)])).toEqual([{ exerciseId: 'strict-pullup', unit: 'reps', value: 6, previous: 5 }]);
    expect(recordsOf(w, [w], [maxEntry(6, START)])).toEqual([]);
    expect(recordsOf(w, [w], [maxEntry(3, addDays(WEEK1, 1))])).toEqual([]);
  });

  it('ignores later workouts and skipped sets; one record per exercise', () => {
    const a = workout(WEEK1, [['plank', [40]]]);
    const b = workout(addDays(WEEK1, 1), [['plank', [45, null]], ['plank', [50]]]);
    const later = workout(addDays(WEEK1, 3), [['plank', [90]]]);
    expect(recordsOf(b, [a, b, later])).toEqual([{ exerciseId: 'plank', unit: 'seconds', value: 50, previous: 40 }]);
    const skipped = workout(addDays(WEEK1, 2), [['plank', [null]]]);
    expect(recordsOf(skipped, [a, skipped])).toEqual([]);
  });
});
