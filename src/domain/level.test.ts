import { describe, expect, it } from 'vitest';
import { WEEK1, complete, history, logged, makeProfile, maxEntry } from '../test/fixtures';
import { levelFromMax, maxEvidence, workingMax } from './level';
import { planDay } from './plan';
import { addDays } from './time';
import type { CompletedWorkout, ExerciseId, ExerciseRole } from './types';

function session(date: string, id: ExerciseId, reps: (number | null)[], role: ExerciseRole = 'main', hour = 18): CompletedWorkout {
  const base = complete(planDay(makeProfile(), history(), date), undefined, hour);
  const ex = { exerciseId: id, slot: `pullVolume.${role}`, sets: reps.length, target: 1, restSec: 90, role };
  return { ...base, exercises: [logged(ex, (_, i) => reps[i] ?? null, base.completedAtUtc)] };
}

describe('levelFromMax', () => {
  it('maps strict pull-up max to levels 0–4', () => {
    const cases: [number | null | undefined, number][] = [[undefined, 0], [null, 0], [-1, 0], [0, 0], [1, 1], [3, 1], [4, 2], [7, 2], [8, 3], [12, 3], [13, 4], [40, 4]];
    for (const [max, level] of cases) expect(levelFromMax(max), String(max)).toBe(level);
  });
});

describe('workingMax — strict, unassisted pull-ups only (guardrail 6)', () => {
  it('is null without any evidence', () => {
    expect(workingMax(history())).toBeNull();
  });

  it('starts from the setup answer', () => {
    expect(workingMax(history({ maxEntries: [maxEntry(5)] }))).toMatchObject({ value: 5, source: 'setup' });
  });

  it('is raised by a better strict set, but not by chin-ups, bands, negatives or muscle-ups', () => {
    const h = history({
      maxEntries: [maxEntry(5)],
      workouts: [
        session(WEEK1, 'chin-up', [9]),
        session(addDays(WEEK1, 1), 'band-pullup', [12]),
        session(addDays(WEEK1, 2), 'negative-pullup', [8]),
        session(addDays(WEEK1, 3), 'muscle-up', [6]),
        session(addDays(WEEK1, 4), 'wide-pullup', [7]),
      ],
    });
    expect(workingMax(h)?.value).toBe(5);
    const better = history({ ...h, workouts: [...h.workouts, session(addDays(WEEK1, 5), 'strict-pullup', [6, 7, null])] });
    expect(workingMax(better)).toMatchObject({ value: 7, source: 'set' });
  });

  it('follows an honest lower self-report or test (the plan follows today’s body)', () => {
    const h = history({
      maxEntries: [maxEntry(8), maxEntry(6, addDays(WEEK1, 2), 'self')],
      workouts: [session(WEEK1, 'strict-pullup', [10])],
    });
    expect(workingMax(h)).toMatchObject({ value: 6, source: 'self' });
    const tested = history({ ...h, workouts: [...h.workouts, session(addDays(WEEK1, 4), 'strict-pullup', [5], 'test')] });
    expect(workingMax(tested)).toMatchObject({ value: 5, source: 'test' });
  });

  it('ignores a test without any completed set', () => {
    const h = history({ maxEntries: [maxEntry(5)], workouts: [session(WEEK1, 'strict-pullup', [null], 'test')] });
    expect(workingMax(h)?.value).toBe(5);
  });

  it('records a test of 0 honestly (level 0)', () => {
    const h = history({ maxEntries: [maxEntry(2)], workouts: [session(WEEK1, 'strict-pullup', [0], 'test')] });
    expect(workingMax(h)).toMatchObject({ value: 0, source: 'test' });
    expect(levelFromMax(workingMax(h)?.value)).toBe(0);
  });

  it('respects the cut-off date', () => {
    const h = history({ maxEntries: [maxEntry(5), maxEntry(9, addDays(WEEK1, 5), 'self')], workouts: [session(addDays(WEEK1, 6), 'strict-pullup', [11])] });
    expect(workingMax(h, addDays(WEEK1, 4))?.value).toBe(5);
    expect(workingMax(h, addDays(WEEK1, 5))?.value).toBe(9);
    expect(workingMax(h)?.value).toBe(11);
  });

  it('orders evidence by time; a test and normal sets in one session count the test first', () => {
    const w = session(WEEK1, 'strict-pullup', [6], 'test');
    w.exercises.push(logged({ exerciseId: 'strict-pullup', slot: 'maxTest.after', sets: 1, target: 3, restSec: 90, role: 'accessory' }, () => 3, w.completedAtUtc));
    const ev = maxEvidence(history({ workouts: [w] }));
    expect(ev.map((e) => e.source)).toEqual(['test', 'set']);
    expect(workingMax(history({ workouts: [w] }))?.value).toBe(6);
  });
});
