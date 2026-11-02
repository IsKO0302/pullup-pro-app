/**
 * The calm "Back up your data" reminder (spec §8): no push, shown on TODAY and
 * YOU only, about every 30 days, dismissible. Pure logic.
 */
import type { Meta } from './types';

export const BACKUP_INTERVAL_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Due when there is history worth protecting and ≥ 30 days have passed since
 * the latest of: the last export (or, if never exported, the first workout)
 * and the last "Later".
 */
export function backupReminderDue(
  meta: Pick<Meta, 'lastExportAtUtc' | 'reminderDismissedAtUtc'>,
  firstWorkoutAtUtc: string | null,
  now: Date,
): boolean {
  if (!firstWorkoutAtUtc) return false;
  const anchors = [meta.lastExportAtUtc ?? firstWorkoutAtUtc, meta.reminderDismissedAtUtc]
    .filter((x): x is string => typeof x === 'string')
    .map((x) => Date.parse(x))
    .filter((x) => Number.isFinite(x));
  if (anchors.length === 0) return false;
  return now.getTime() - Math.max(...anchors) >= BACKUP_INTERVAL_DAYS * DAY_MS;
}
