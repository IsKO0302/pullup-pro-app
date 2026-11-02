import { isTraining, type History } from './history';
import { scheduledOn } from './schedule';
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

/** Day lookups built once per render (cheap even for years of history). */
export interface DayIndex {
  /** Days with a training or recovery-mobility session. */
  done: ReadonlySet<LocalDate>;
  /** Days with a real training session (counts toward the rhythm). */
  trained: ReadonlySet<LocalDate>;
  /** Days the user chose to rest. */
  recovery: ReadonlySet<LocalDate>;
}

export function indexDays(history: Pick<History, 'workouts' | 'recoveryDays'>): DayIndex {
  const done = new Set<LocalDate>();
  const trained = new Set<LocalDate>();
  for (const w of history.workouts) {
    if (isTraining(w)) trained.add(w.localDate);
    if (isTraining(w) || w.type === 'recovery') done.add(w.localDate);
  }
  return { done, trained, recovery: new Set(history.recoveryDays.map((r) => r.localDate)) };
}

type ScheduleProfile = Pick<Profile, 'daysPerWeek' | 'rhythmChanges' | 'startDate'>;

export function dayStateIn(index: DayIndex, profile: ScheduleProfile, date: LocalDate, today: LocalDate): DayCell {
  const scheduled = scheduledOn(profile, date);
  const cell = (state: DayState): DayCell => ({ date, state, scheduled, isToday: date === today });
  if (index.done.has(date)) return cell('done');
  if (index.recovery.has(date)) return cell('recovery');
  if (date === today) return cell(scheduled === null ? 'rest' : 'today');
  if (date > today) return cell(scheduled === null ? 'rest' : 'planned');
  return cell(scheduled === null || scheduled === 'recovery' ? 'rest' : 'missed');
}

export function dayState(profile: ScheduleProfile, history: History, date: LocalDate, today: LocalDate): DayCell {
  return dayStateIn(indexDays(history), profile, date, today);
}

/** Monday–Sunday of the week containing `today`. */
export function weekStrip(profile: ScheduleProfile, history: History, today: LocalDate): DayCell[] {
  const index = indexDays(history);
  return weekDates(today).map((d) => dayStateIn(index, profile, d, today));
}
