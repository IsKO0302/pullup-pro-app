import { addDays, daysBetween, weekdayIndex, weekStart, type LocalDate } from './time';
import type { DayType } from './types';

const P: DayType = 'pullStrength';
const V: DayType = 'pullVolume';
const U: DayType = 'push';
const L: DayType = 'legsCore';
const R: DayType = 'recovery';

/**
 * Monday-first weekly templates (null = planned rest). Rules (tested):
 * one PULL · STRENGTH per week (so never two within 48 h), at least one
 * RECOVERY day at 6–7 days, pull days separated by at least one day.
 */
export const WEEK_TEMPLATES: Readonly<Record<number, readonly (DayType | null)[]>> = {
  2: [P, null, null, V, null, null, null],
  3: [P, null, U, null, V, null, null],
  4: [P, U, null, V, L, null, null],
  5: [P, U, L, null, V, R, null],
  6: [P, U, L, V, R, U, null],
  7: [P, U, L, V, R, L, R],
};

export function clampDays(daysPerWeek: number): number {
  return Math.min(7, Math.max(2, Math.round(daysPerWeek)));
}

export function scheduledType(daysPerWeek: number, date: LocalDate): DayType | null {
  return WEEK_TEMPLATES[clampDays(daysPerWeek)]![weekdayIndex(date)] ?? null;
}

/** With 2–3 days a week every session also carries small push/legs/core accessories. */
export function isBalancedTemplate(daysPerWeek: number): boolean {
  return clampDays(daysPerWeek) <= 3;
}

/** 0-based program week counted from the Monday of the start week. */
export function programWeek(startDate: LocalDate, date: LocalDate): number {
  return Math.max(0, Math.floor(daysBetween(weekStart(startDate), weekStart(date)) / 7));
}

/** Every 4th week (weeks 4, 8, 12 …) is a lighter week. */
export function isLighterWeek(startDate: LocalDate, date: LocalDate): boolean {
  return programWeek(startDate, date) % 4 === 3;
}

/** The week after each lighter week: a max test is suggested (never forced). */
export function isMaxTestWeek(startDate: LocalDate, date: LocalDate): boolean {
  const w = programWeek(startDate, date);
  return w > 0 && w % 4 === 0;
}

/** The next planned training day strictly after `date` (within a week). */
export function nextScheduled(daysPerWeek: number, date: LocalDate): { date: LocalDate; type: DayType } | null {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    const type = scheduledType(daysPerWeek, d);
    if (type) return { date: d, type };
  }
  return null;
}
