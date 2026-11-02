import { describe, expect, it } from 'vitest';
import { backupReminderDue } from './backup';

const at = (d: string) => new Date(`${d}T12:00:00.000Z`);
const none = { lastExportAtUtc: null, reminderDismissedAtUtc: null };

describe('backup reminder', () => {
  it('never shows without history', () => {
    expect(backupReminderDue(none, null, at('2030-01-01'))).toBe(false);
  });

  it('first appears 30 days after the first workout when nothing was exported', () => {
    expect(backupReminderDue(none, '2026-01-01T12:00:00.000Z', at('2026-01-30'))).toBe(false);
    expect(backupReminderDue(none, '2026-01-01T12:00:00.000Z', at('2026-01-31'))).toBe(true);
  });

  it('comes back about every 30 days after an export or a "Later"', () => {
    const first = '2025-06-01T12:00:00.000Z';
    expect(backupReminderDue({ ...none, lastExportAtUtc: '2026-01-10T12:00:00.000Z' }, first, at('2026-02-08'))).toBe(false);
    expect(backupReminderDue({ ...none, lastExportAtUtc: '2026-01-10T12:00:00.000Z' }, first, at('2026-02-09'))).toBe(true);
    expect(backupReminderDue({ lastExportAtUtc: '2026-01-10T12:00:00.000Z', reminderDismissedAtUtc: '2026-02-09T12:00:00.000Z' }, first, at('2026-03-01'))).toBe(false);
    expect(backupReminderDue({ lastExportAtUtc: '2026-01-10T12:00:00.000Z', reminderDismissedAtUtc: '2026-02-09T12:00:00.000Z' }, first, at('2026-03-11'))).toBe(true);
  });

  it('ignores unreadable timestamps instead of nagging', () => {
    expect(backupReminderDue({ lastExportAtUtc: 'garbage', reminderDismissedAtUtc: null }, 'garbage', at('2026-03-11'))).toBe(false);
  });
});
