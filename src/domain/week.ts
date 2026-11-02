import { isTraining, type History } from './history';
import { scheduleRange, type DaySchedule } from './rotation';
import type { ScheduleProfile } from './schedule';
import { weekDates, weekStart, type LocalDate } from './time';
import type { DayType, RotationState } from './types';

/**
 * done = trained (or did the recovery session) · recovery = the user chose to
 * rest (never "missed"; the session waits for the next training day) · rest =
 * planned rest, a recovery day that passed quietly, or a training day after this
 * week's training was already done · planned = coming up · today = not done yet
 * · missed = a past training day with nothing logged (shown neutrally as "not
 * trained").
 */
export type DayState = 'done' | 'today' | 'planned' | 'rest' | 'recovery' | 'missed';

export interface DayCell {
  date: LocalDate;
  state: DayState;
  /** Planned session that day (null = rest). */
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
  /** Days with a real training session (counts toward the weekly training target). */
  trained: ReadonlySet<LocalDate>;
  /** Days with a recovery-mobility session. */
  recoverySessions: ReadonlySet<LocalDate>;
  /** Days the user chose to rest. */
  recovery: ReadonlySet<LocalDate>;
}

export function indexDays(history: Pick<History, 'workouts' | 'recoveryDays'>): DayIndex {
  const done = new Set<LocalDate>();
  const trained = new Set<LocalDate>();
  const recoverySessions = new Set<LocalDate>();
  for (const w of history.workouts) {
    if (isTraining(w)) trained.add(w.localDate);
    if (w.type === 'recovery') recoverySessions.add(w.localDate);
    if (isTraining(w) || w.type === 'recovery') done.add(w.localDate);
  }
  return { done, trained, recoverySessions, recovery: new Set(history.recoveryDays.map((r) => r.localDate)) };
}

export function cellOf(index: DayIndex, day: DaySchedule, today: LocalDate): DayCell {
  const { date } = day;
  const cell = (state: DayState): DayCell => ({ date, state, scheduled: day.type, isToday: date === today });
  if (index.done.has(date)) return cell('done');
  if (index.recovery.has(date)) return cell('recovery');
  const active = !day.beforeStart && day.kind !== 'rest';
  if (date === today) return cell(active ? 'today' : 'rest');
  if (date > today) return cell(active ? 'planned' : 'rest');
  return cell(active && day.kind === 'training' ? 'missed' : 'rest');
}

/** Monday–Sunday of the week containing `today` (later days are projected from the plan). */
export function weekStrip(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  today: LocalDate,
  checkpoint?: RotationState | null,
): DayCell[] {
  const index = indexDays(history);
  const dates = weekDates(today);
  const days = scheduleRange(profile, history, weekStart(today), dates[6]!, today, checkpoint);
  return days.map((d) => cellOf(index, d, today));
}

/** One day's cell (same rules as the week strip). */
export function dayState(
  profile: ScheduleProfile,
  history: Pick<History, 'workouts' | 'recoveryDays'>,
  date: LocalDate,
  today: LocalDate,
  checkpoint?: RotationState | null,
): DayCell {
  return cellOf(indexDays(history), scheduleRange(profile, history, date, date, today, checkpoint)[0]!, today);
}
