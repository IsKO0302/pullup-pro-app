import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isValidLocalDate, localDateOf, makeStamp, weekDates, weekStart, weekdayIndex, compareLocalDates } from './time';

describe('time', () => {
  it('captures the local calendar date in the recorded zone', () => {
    const instant = new Date('2026-11-01T21:30:00Z'); // 00:30 next day in Istanbul
    expect(localDateOf(instant, 'Europe/Istanbul')).toBe('2026-11-02');
    expect(localDateOf(instant, 'America/New_York')).toBe('2026-11-01');
    expect(localDateOf(instant, 'UTC')).toBe('2026-11-01');
  });

  it('keeps the original date of an event after a later time-zone change', () => {
    const stamp = makeStamp(new Date('2026-11-01T21:30:00Z'), 'Europe/Istanbul');
    expect(stamp).toEqual({ atUtc: '2026-11-01T21:30:00.000Z', localDate: '2026-11-02', timeZone: 'Europe/Istanbul' });
    // Re-deriving in another zone would give a different day; the stamp keeps its own.
    expect(localDateOf(new Date(stamp.atUtc), 'America/Los_Angeles')).toBe('2026-11-01');
    expect(stamp.localDate).toBe('2026-11-02');
  });

  it('does day arithmetic across DST changes without losing or duplicating days', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-02', '2026-10-26')).toBe(-7);
    const days = Array.from({ length: 400 }, (_, i) => addDays('2026-01-01', i));
    expect(new Set(days).size).toBe(400);
  });

  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-08')).toBe(6); // Sunday
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekDates('2026-11-04')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });

  it('validates local dates strictly', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('26-2-3')).toBe(false);
    expect(isValidLocalDate(20260101)).toBe(false);
    expect(compareLocalDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareLocalDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareLocalDates('2026-01-02', '2026-01-02')).toBe(0);
    expect(() => addDays('nope', 1)).toThrow();
  });
});
