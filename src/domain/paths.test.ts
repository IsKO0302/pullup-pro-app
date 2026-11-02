import { describe, expect, it } from 'vitest';
import { START, complete, history, logged, makeProfile, maxEntry } from '../test/fixtures';
import { muscleUpPath, pullupPath } from './paths';
import { planDay } from './plan';
import type { CompletedWorkout, ExerciseId } from './types';

function best(entries: [ExerciseId, number][]): CompletedWorkout {
  const base = complete(planDay(makeProfile(), history(), START));
  return {
    ...base,
    exercises: entries.map(([id, value], i) => logged({ exerciseId: id, slot: `pullVolume.s${i}`, sets: 1, target: value, restSec: 60, role: 'accessory' }, () => value, base.completedAtUtc)),
  };
}

describe('Pull-up Path', () => {
  it('starts at stage 1 (dead hang)', () => {
    expect(pullupPath(history())).toEqual({ stage: 1, complete: false });
  });

  it('advances stage by stage on plain logged numbers', () => {
    const steps: [[ExerciseId, number][], number][] = [
      [[['dead-hang', 29]], 1],
      [[['dead-hang', 30]], 2],
      [[['active-hang', 30], ['scapular-pull', 10]], 3],
      [[['dead-hang', 30], ['scapular-pull', 10], ['negative-pullup', 5]], 4],
      [[['band-pullup', 8]], 5],
    ];
    for (const [entries, stage] of steps) expect(pullupPath(history({ workouts: [best(entries)] })).stage, JSON.stringify(entries)).toBe(stage);
  });

  it('uses the strict max for the later stages', () => {
    expect(pullupPath(history({ maxEntries: [maxEntry(1)] })).stage).toBe(5);
    expect(pullupPath(history({ maxEntries: [maxEntry(12)] })).stage).toBe(6);
    expect(pullupPath(history({ maxEntries: [maxEntry(12)], workouts: [best([['weighted-pullup', 5]])] }))).toEqual({ stage: 6, complete: true });
  });
});

describe('Muscle-up Path', () => {
  it('needs 8 strict pull-ups plus a pushing base first', () => {
    expect(muscleUpPath(history({ maxEntries: [maxEntry(8)] }), ['bar']).stage).toBe(1);
    expect(muscleUpPath(history({ maxEntries: [maxEntry(8)], workouts: [best([['pushup', 15]])] }), ['bar']).stage).toBe(2);
    // With dip bars, the pushing base is 10 dips.
    expect(muscleUpPath(history({ maxEntries: [maxEntry(8)], workouts: [best([['pushup', 15]])] }), ['bar', 'dipBars']).stage).toBe(1);
    expect(muscleUpPath(history({ maxEntries: [maxEntry(8)], workouts: [best([['parallel-dips', 10]])] }), ['bar', 'dipBars']).stage).toBe(2);
  });

  it('walks through high pull-ups, bar dips, negatives and band muscle-ups', () => {
    const base: [ExerciseId, number][] = [['pushup', 15]];
    const h = (more: [ExerciseId, number][]) => history({ maxEntries: [maxEntry(10)], workouts: [best([...base, ...more])] });
    expect(muscleUpPath(h([['high-pullup', 5]]), ['bar']).stage).toBe(3);
    expect(muscleUpPath(h([['high-pullup', 5], ['straight-bar-dip', 8]]), ['bar']).stage).toBe(4);
    expect(muscleUpPath(h([['high-pullup', 5], ['straight-bar-dip', 8], ['negative-muscle-up', 3]]), ['bar']).stage).toBe(5);
    expect(muscleUpPath(h([['band-muscle-up', 3]]), ['bar']).stage).toBe(6);
    expect(muscleUpPath(h([['muscle-up', 1]]), ['bar'])).toEqual({ stage: 6, complete: true });
  });
});
