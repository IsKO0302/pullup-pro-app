import { describe, expect, it } from 'vitest';
import { SET_SETUP_SEC, TRANSITION_SEC, estimateMinutes, estimateSeconds, fitDuration, setSeconds, type FitItem } from './duration';
import type { ExerciseId, PlannedExercise } from './types';

const ex = (exerciseId: ExerciseId, sets: number, target: number, restSec: number, slot = exerciseId): PlannedExercise => ({ exerciseId, slot, sets, target, restSec, role: 'main' });
const item = (e: PlannedExercise, minSets: number, maxSets: number): FitItem => ({ ex: e, minSets, maxSets, minRest: 15, maxRest: Math.round(e.restSec * 1.5) });

describe('duration estimate', () => {
  it('counts work per set (reps × pace, seconds as is, both sides) plus setup', () => {
    expect(setSeconds({ exerciseId: 'squat', target: 10 })).toBe(10 * 3 + SET_SETUP_SEC);
    expect(setSeconds({ exerciseId: 'plank', target: 30 })).toBe(30 + SET_SETUP_SEC);
    expect(setSeconds({ exerciseId: 'reverse-lunge', target: 8 })).toBe(8 * 3 * 2 + SET_SETUP_SEC);
  });

  it('adds rest after every set except the very last one, and transitions between exercises', () => {
    const a = ex('squat', 3, 10, 60);
    const b = ex('plank', 2, 30, 45);
    expect(estimateSeconds([a, b])).toBe(3 * 38 + 3 * 60 + TRANSITION_SEC + 2 * 38 + 1 * 45);
    expect(estimateSeconds([])).toBe(0);
    expect(estimateMinutes([])).toBe(1);
    expect(estimateMinutes([a, b])).toBe(Math.round(estimateSeconds([a, b]) / 60));
  });
});

describe('fitDuration', () => {
  const items = () => [
    item(ex('squat', 4, 12, 60), 2, 6),
    item(ex('glute-bridge', 3, 12, 60), 2, 4),
    item(ex('plank', 2, 30, 45), 1, 4),
    item(ex('calf-raise', 2, 15, 45), 1, 4),
  ];

  it('returns nothing for no items', () => {
    expect(fitDuration([], 30)).toEqual([]);
  });

  it('lands within ±15 % of the chosen length when possible', () => {
    for (const minutes of [10, 15, 20, 25]) {
      const sec = estimateSeconds(fitDuration(items(), minutes));
      expect(sec, `${minutes} min`).toBeGreaterThanOrEqual(minutes * 60 * 0.85);
      expect(sec, `${minutes} min`).toBeLessThanOrEqual(minutes * 60 * 1.15);
    }
  });

  it('keeps the priority order, the main block first, and set limits', () => {
    const out = fitDuration(items(), 10);
    expect(out[0]!.exerciseId).toBe('squat');
    const all = fitDuration(items(), 60);
    expect(all.map((e) => e.exerciseId)).toEqual(['squat', 'glute-bridge', 'plank', 'calf-raise']);
    all.forEach((e, i) => expect(e.sets).toBeLessThanOrEqual(items()[i]!.maxSets));
    expect(fitDuration(items(), 3)).toHaveLength(1);
  });

  it('nudges rest within bounds when sets alone cannot reach the length', () => {
    const out = fitDuration([item(ex('squat', 2, 12, 60), 2, 2)], 4);
    expect(out[0]!.restSec).toBeGreaterThan(60);
    expect(out[0]!.restSec).toBeLessThanOrEqual(90);
    const short = fitDuration([item(ex('plank', 3, 60, 120), 3, 3)], 3);
    expect(short[0]!.restSec).toBeLessThan(120);
    expect(short[0]!.restSec).toBeGreaterThanOrEqual(15);
  });

  it('does not mutate the input items', () => {
    const input = items();
    const copy = JSON.stringify(input);
    fitDuration(input, 30);
    expect(JSON.stringify(input)).toBe(copy);
  });
});
