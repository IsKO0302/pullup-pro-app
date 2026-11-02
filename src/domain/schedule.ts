import { addDays, daysBetween, weekdayIndex, weekStart, type LocalDate } from './time';
import type { DayType, Profile } from './types';

const P: DayType = 'pullStrength';
const V: DayType = 'pullVolume';
const U: DayType = 'push';
const L: DayType = 'legsCore';

/**
 * What a calendar day is for. `daysPerWeek` counts ACTIVE days: training slots
 * plus recovery slots (DECISIONS D54). Which training session a training slot
 * gets is decided by the rotation (rotation.ts), not by the weekday.
 */
export type SlotKind = 'training' | 'recovery' | 'rest';

const T: SlotKind = 'training';
const R: SlotKind = 'recovery';
const _: SlotKind = 'rest';

/** Monday-first weekly slot layouts per active days per week. */
export const WEEK_SLOTS: Readonly<Record<number, readonly SlotKind[]>> = {
  2: [T, _, _, T, _, _, _],
  3: [T, _, T, _, T, _, _],
  4: [T, T, _, T, T, _, _],
  5: [T, T, _, T, T, R, _],
  6: [T, T, T, T, R, T, _],
  7: [T, T, T, T, R, T, R],
};

/**
 * Training session order per active days per week. One PULL · STRENGTH per
 * cycle; from 4 days on, pull and non-pull sessions alternate around the whole
 * cycle (also across the wrap), so a session that moves to the next training
 * day can never put two pull days back to back. With 2–3 days the training
 * slots themselves are never on consecutive days.
 */
export const ROTATIONS: Readonly<Record<number, readonly DayType[]>> = {
  2: [P, V],
  3: [P, U, V],
  4: [P, U, V, L],
  5: [P, U, V, L],
  6: [P, U, L, V, U],
  7: [P, U, L, V, L],
};

export function clampDays(daysPerWeek: number): number {
  return Math.min(7, Math.max(2, Math.round(daysPerWeek)));
}

/** The calendar slot of `date` for a given active-days setting. */
export function slotOf(daysPerWeek: number, date: LocalDate): SlotKind {
  return WEEK_SLOTS[clampDays(daysPerWeek)]![weekdayIndex(date)]!;
}

/** Weekly targets: training sessions and recovery days per active-days setting. */
export function weekTargets(daysPerWeek: number): { active: number; training: number; recovery: number } {
  const slots = WEEK_SLOTS[clampDays(daysPerWeek)]!;
  const training = slots.filter((s) => s === 'training').length;
  const recovery = slots.filter((s) => s === 'recovery').length;
  return { active: training + recovery, training, recovery };
}

/**
 * The week a user sees when every training session happens on its day
 * (null = rest). Each week has exactly one rotation cycle of training slots, so
 * following the plan repeats this week after week.
 */
export function planTemplate(daysPerWeek: number): (DayType | null)[] {
  const days = clampDays(daysPerWeek);
  const rotation = ROTATIONS[days]!;
  let i = 0;
  return WEEK_SLOTS[days]!.map((s) => (s === 'training' ? rotation[i++ % rotation.length]! : s === 'recovery' ? 'recovery' : null));
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

export type ScheduleProfile = Pick<Profile, 'daysPerWeek' | 'rhythmChanges' | 'startDate'>;

/** The days-per-week setting that applied on `date` (past weeks keep their own rhythm). */
export function daysPerWeekOn(profile: Pick<Profile, 'daysPerWeek' | 'rhythmChanges'>, date: LocalDate): number {
  const log = profile.rhythmChanges ?? [];
  if (log.length === 0) return clampDays(profile.daysPerWeek);
  let days = log[0]!.daysPerWeek;
  for (const c of log) if (c.from <= date) days = c.daysPerWeek;
  return clampDays(days);
}

/** Changing the rhythm applies from `today` on; earlier days keep the old value. */
export function withRhythm<Q extends ScheduleProfile>(profile: Q, daysPerWeek: number, today: LocalDate): Q {
  const days = clampDays(daysPerWeek);
  if (days === profile.daysPerWeek) return profile;
  const log = profile.rhythmChanges?.length ? profile.rhythmChanges : [{ from: profile.startDate, daysPerWeek: profile.daysPerWeek }];
  const kept = log.filter((c) => c.from < today);
  return { ...profile, daysPerWeek: days, rhythmChanges: [...kept, { from: today, daysPerWeek: days }] };
}

/** The calendar slot on `date` with the rhythm that applied that day; null before the program started. */
export function slotOn(profile: ScheduleProfile, date: LocalDate): SlotKind | null {
  if (date < profile.startDate) return null;
  return slotOf(daysPerWeekOn(profile, date), date);
}

/** Training slots of the week containing `date`, counting only days on or after the start. */
export function trainingSlotsInWeek(profile: ScheduleProfile, date: LocalDate): { training: number; recovery: number } {
  const monday = weekStart(date);
  let training = 0;
  let recovery = 0;
  for (let i = 0; i < 7; i++) {
    const slot = slotOn(profile, addDays(monday, i));
    if (slot === 'training') training++;
    else if (slot === 'recovery') recovery++;
  }
  return { training, recovery };
}
