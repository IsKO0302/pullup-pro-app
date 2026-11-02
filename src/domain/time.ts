/**
 * Calendar-date helpers. A LocalDate is the user's local calendar day
 * ("YYYY-MM-DD") captured AT THE TIME of an event. It is stored next to the
 * UTC instant and the IANA time zone and is never recomputed later, so a later
 * time-zone change cannot move a completed workout to another day.
 * All arithmetic runs on UTC midnights, so DST changes cannot drop or
 * duplicate days.
 */
export type LocalDate = string;

export interface EventStamp {
  /** ISO-8601 UTC instant, e.g. 2026-11-02T05:30:00.000Z */
  atUtc: string;
  /** Local calendar date at the time of the event. */
  localDate: LocalDate;
  /** IANA time zone recorded at the time of the event, when available. */
  timeZone: string | null;
}

const DAY_MS = 86_400_000;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localDateOf(instant: Date, timeZone?: string | null): LocalDate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone ?? undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === value;
}

export function utcMidnight(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date(utcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from a to b (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday (training weeks start on Monday). */
export function weekdayIndex(date: LocalDate): number {
  return (new Date(utcMidnight(date)).getUTCDay() + 6) % 7;
}

export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date));
}

export function weekDates(date: LocalDate): LocalDate[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function makeStamp(now: Date, timeZone: string | null): EventStamp {
  return { atUtc: now.toISOString(), localDate: localDateOf(now, timeZone), timeZone };
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
