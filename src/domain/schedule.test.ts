import { describe, expect, it } from 'vitest';
import { START } from '../test/fixtures';
import {
  ROTATIONS, WEEK_SLOTS, clampDays, daysPerWeekOn, isBalancedTemplate, isLighterWeek, isMaxTestWeek, planTemplate, programWeek, slotOf, slotOn,
  trainingSlotsInWeek, weekTargets, withRhythm,
} from './schedule';
import { addDays } from './time';
import { DAYS_PER_WEEK, type DayType, type Profile } from './types';

const PULL: readonly (DayType | null)[] = ['pullStrength', 'pullVolume'];

describe('weekly layouts (active days = training slots + recovery slots)', () => {
  for (const days of DAYS_PER_WEEK) {
    it(`${days} active days: one rotation cycle per week, pull days never back to back`, () => {
      const slots = WEEK_SLOTS[days]!;
      expect(slots).toHaveLength(7);
      expect(slots.filter((x) => x !== 'rest')).toHaveLength(days);
      expect(slots[0]).toBe('training');
      expect(slots[6]).toBe(days === 7 ? 'recovery' : 'rest');
      const targets = weekTargets(days);
      expect(targets.active).toBe(days);
      expect(targets.training + targets.recovery).toBe(days);
      expect(targets.training).toBe(ROTATIONS[days]!.length);

      const t = planTemplate(days);
      expect(t[0]).toBe('pullStrength');
      expect(t.filter((x) => x === 'pullStrength')).toHaveLength(1);
      expect(t.filter((x) => x === 'recovery')).toHaveLength(targets.recovery);
      expect(t.every((x) => x !== 'maxTest' && x !== 'short' && x !== 'light')).toBe(true);
      for (let i = 0; i < 7; i++) {
        if (PULL.includes(t[i]!)) expect(PULL.includes(t[(i + 1) % 7]!), `day ${i}`).toBe(false);
      }
      const r = ROTATIONS[days]!;
      if (days >= 4) {
        // A session that moves to the next training day can never stack two pull days.
        for (let i = 0; i < r.length; i++) expect(PULL.includes(r[i]!) && PULL.includes(r[(i + 1) % r.length]!), `rotation ${i}`).toBe(false);
      } else {
        // 2–3 days: training slots are never on consecutive days (wrap included).
        for (let i = 0; i < 7; i++) expect(slots[i] === 'training' && slots[(i + 1) % 7] === 'training', `slot ${i}`).toBe(false);
      }
    });
  }

  it('spells out every layout and its weekly targets (training sessions ≠ active days)', () => {
    const P = 'pullStrength', V = 'pullVolume', U = 'push', L = 'legsCore', R = 'recovery', _ = null;
    expect(DAYS_PER_WEEK.map(planTemplate)).toEqual([
      [P, _, _, V, _, _, _],
      [P, _, U, _, V, _, _],
      [P, U, _, V, L, _, _],
      [P, U, _, V, L, R, _],
      [P, U, L, V, R, U, _],
      [P, U, L, V, R, L, R],
    ]);
    expect(DAYS_PER_WEEK.map((d) => [d, weekTargets(d).training, weekTargets(d).recovery])).toEqual([
      [2, 2, 0], [3, 3, 0], [4, 4, 0], [5, 4, 1], [6, 5, 1], [7, 5, 2],
    ]);
  });

  it('clamps unusual day counts', () => {
    expect(clampDays(0)).toBe(2);
    expect(clampDays(9)).toBe(7);
    expect(clampDays(4.4)).toBe(4);
    expect(slotOf(1, START)).toBe('training');
    expect(weekTargets(12)).toEqual(weekTargets(7));
  });

  it('marks 2–3 day weeks as balanced (accessories inside the pull days)', () => {
    expect([2, 3, 4, 7].map(isBalancedTemplate)).toEqual([true, true, false, false]);
  });
});

describe('program weeks', () => {
  it('counts weeks from the Monday of the start week', () => {
    const wednesdayStart = addDays(START, 2);
    expect(programWeek(wednesdayStart, START)).toBe(0);
    expect(programWeek(wednesdayStart, addDays(START, 6))).toBe(0);
    expect(programWeek(wednesdayStart, addDays(START, 7))).toBe(1);
    expect(programWeek(START, addDays(START, -10))).toBe(0);
  });

  it('every 4th week is lighter, the week after suggests a max test', () => {
    const weeks = Array.from({ length: 13 }, (_, w) => addDays(START, w * 7));
    expect(weeks.map((d) => isLighterWeek(START, d))).toEqual([false, false, false, true, false, false, false, true, false, false, false, true, false]);
    expect(weeks.map((d) => isMaxTestWeek(START, d))).toEqual([false, false, false, false, true, false, false, false, true, false, false, false, true]);
  });
});

describe('rhythm changes', () => {
  const base: Pick<Profile, 'daysPerWeek' | 'startDate' | 'rhythmChanges'> = { daysPerWeek: 4, startDate: '2026-01-05' };

  it('without changes the current value applies everywhere', () => {
    expect(daysPerWeekOn(base, '2025-01-01')).toBe(4);
    expect(daysPerWeekOn(base, '2030-01-01')).toBe(4);
  });

  it('a change applies from that day on; earlier days keep the old value', () => {
    const p = withRhythm(base, 6, '2026-02-02');
    expect(p.daysPerWeek).toBe(6);
    expect(daysPerWeekOn(p, '2026-02-01')).toBe(4);
    expect(daysPerWeekOn(p, '2026-02-02')).toBe(6);
    expect(daysPerWeekOn(p, '2025-12-01')).toBe(4);
    const q = withRhythm(p, 3, '2026-03-02');
    expect(q.rhythmChanges?.map((c) => [c.from, c.daysPerWeek])).toEqual([['2026-01-05', 4], ['2026-02-02', 6], ['2026-03-02', 3]]);
    expect(daysPerWeekOn(q, '2026-02-20')).toBe(6);
  });

  it('several changes on one day keep only the last; same value is a no-op; values are clamped', () => {
    const p = withRhythm(withRhythm(base, 6, '2026-02-02'), 5, '2026-02-02');
    expect(p.rhythmChanges).toEqual([{ from: '2026-01-05', daysPerWeek: 4 }, { from: '2026-02-02', daysPerWeek: 5 }]);
    expect(withRhythm(base, 4, '2026-02-02')).toBe(base);
    expect(withRhythm(base, 12, '2026-02-02').daysPerWeek).toBe(7);
  });

  it('slotOn is null before the program starts and follows the rhythm of each day', () => {
    expect(slotOn(base, '2026-01-04')).toBeNull();
    expect(slotOn(base, '2026-01-05')).toBe('training');
    expect(slotOn(base, '2026-01-07')).toBe('rest');
    const p = withRhythm(base, 5, '2026-02-02');
    expect(slotOn(p, '2026-01-31')).toBe('rest');
    expect(slotOn(p, '2026-02-07')).toBe('recovery');
  });

  it('counts the slots of a week on or after the start only', () => {
    const wednesday = { ...base, startDate: '2026-01-07' };
    expect(trainingSlotsInWeek(wednesday, '2026-01-07')).toEqual({ training: 2, recovery: 0 });
    expect(trainingSlotsInWeek(wednesday, '2026-01-12')).toEqual({ training: 4, recovery: 0 });
    expect(trainingSlotsInWeek({ ...base, daysPerWeek: 7 }, '2026-01-05')).toEqual({ training: 5, recovery: 2 });
  });
});
