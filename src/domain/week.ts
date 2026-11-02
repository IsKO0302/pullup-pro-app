import { isTraining, type History } from './history';
import { scheduledType } from './schedule';
import { weekDates, type LocalDate } from './time';
import type { DayType, Profile } from './types';

/**
 * done = trained (or did the planned recovery session) · recovery = the user chose
 * to rest (counts toward the rhythm, never "missed") · rest = planned rest ·
 * planned = coming up · today = not done yet · missed = a past training day with
 * nothing logged (shown neutrally as "not trained").
 */
export type DayState = 'done' | 'today' | 'planned' | 'rest' | 'recovery' | 'missed';

export interface DayCell {
  date: LocalDate;
  state: DayState;
  scheduled: DayType | null;
  isToday: boolean;
}

export function trainedOn(history: Pick<History, 'workouts'>, date: LocalDate): boolean {
  return history.workouts.some((w) => w.localDate === date && (isTraining(w) || w.type === 'recovery'));
}

export function dayState(profile: Profile, history: History, date: LocalDate, today: LocalDate): DayCell {
  const scheduled = date < profile.startDate ? null : scheduledType(profile.daysPerWeek, date);
  const cell = (state: DayState): DayCell => ({ date, state, scheduled, isToday: date === today });
  if (trainedOn(history, date)) return cell('done');
  if (history.recoveryDays.some((r) => r.localDate === date)) return cell('recovery');
  if (date === today) return cell(scheduled === null ? 'rest' : 'today');
  if (date > today) return cell(scheduled === null ? 'rest' : 'planned');
  return cell(scheduled === null || scheduled === 'recovery' ? 'rest' : 'missed');
}

/** Monday–Sunday of the week containing `today`. */
export function weekStrip(profile: Profile, history: History, today: LocalDate): DayCell[] {
  return weekDates(today).map((d) => dayState(profile, history, d, today));
}
