import { describe, expect, it } from 'vitest';
import { START } from '../test/fixtures';
import { WEEK_TEMPLATES, clampDays, daysPerWeekOn, isBalancedTemplate, isLighterWeek, isMaxTestWeek, nextScheduled, programWeek, scheduledOn, scheduledType, withRhythm } from './schedule';
import { addDays } from './time';
import { DAYS_PER_WEEK, type DayType, type Profile } from './types';

const PULL: readonly (DayType | null)[] = ['pullStrength', 'pullVolume'];

describe('weekly templates', () => {
  for (const days of DAYS_PER_WEEK) {
    it(`${days} days: right count, one strength day, pull days never back to back`, () => {
      const t = WEEK_TEMPLATES[days]!;
      expect(t).toHaveLength(7);
      expect(t.filter((x) => x !== null)).toHaveLength(days);
      expect(t.filter((x) => x === 'pullStrength')).toHaveLength(1);
      for (let i = 0; i < 7; i++) {
        const next = t[(i + 1) % 7]!;
        if (PULL.includes(t[i]!)) expect(PULL.includes(next), `day ${i}`).toBe(false);
      }
      if (days >= 6) expect(t.filter((x) => x === 'recovery').length).toBeGreaterThanOrEqual(1);
      expect(t.every((x) => x !== 'maxTest' && x !== 'short' && x !== 'light')).toBe(true);
    });
  }

  it('clamps unusual day counts', () => {
    expect(clampDays(0)).toBe(2);
    expect(clampDays(9)).toBe(7);
    expect(clampDays(4.4)).toBe(4);
    expect(scheduledType(1, START)).toBe('pullStrength');
  });

  it('starts every week (Monday) with the strength day and keeps Sunday free below 7 days', () => {
    for (const days of DAYS_PER_WEEK) {
      expect(scheduledType(days, START)).toBe('pullStrength');
      expect(scheduledType(days, addDays(START, 6))).toBe(days === 7 ? 'recovery' : null);
    }
  });

  it('finds the next planned training day', () => {
    expect(nextScheduled(4, addDays(START, 4))).toEqual({ date: addDays(START, 7), type: 'pullStrength' });
    expect(nextScheduled(4, START)).toEqual({ date: addDays(START, 1), type: 'push' });
    expect(nextScheduled(2, addDays(START, 3))).toEqual({ date: addDays(START, 7), type: 'pullStrength' });
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

  it('scheduledOn is null before the program starts', () => {
    expect(scheduledOn(base, '2026-01-04')).toBeNull();
    expect(scheduledOn(base, '2026-01-05')).toBe('pullStrength');
  });
});
