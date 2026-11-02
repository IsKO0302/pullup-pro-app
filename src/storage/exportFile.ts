/**
 * Export of ALL user data as ONE human-readable JSON file (spec §8).
 * Pure and tiny (TODAY's backup reminder uses it); validation and import live
 * in importFile.ts.
 */
import type { AppData, Meta } from '../domain/types';
import type { EventStamp, LocalDate } from '../domain/time';
import { SCHEMA_VERSION } from './db';

export const EXPORT_FORMAT = 'pullup-pro-export';

/** Everything in AppData except facts about THIS browser (meta.persist). */
export type ExportData = Omit<AppData, 'meta'> & { meta: Omit<Meta, 'persist'> };

export interface ExportSummary {
  workouts: number;
  notes: number;
  favorites: number;
  recoveryDays: number;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  appVersion: string;
  /** UTC instant + local calendar date + time zone of the export (guardrail 7). */
  exportedAt: string;
  exportedLocalDate: LocalDate;
  timeZone: string | null;
  /** For people reading the file. Never trusted on import — counts are recomputed. */
  summary: ExportSummary;
  data: ExportData;
}

export function summarize(data: Pick<AppData, 'workouts' | 'favorites' | 'recoveryDays'>): ExportSummary {
  return {
    workouts: data.workouts.length,
    notes: data.workouts.filter((w) => w.note.trim() !== '').length,
    favorites: data.favorites.length,
    recoveryDays: data.recoveryDays.length,
  };
}

/**
 * The file records itself as the latest export, so "export → reset → import"
 * restores exactly the state the app had right after exporting.
 */
export function buildExport(data: AppData, stamp: EventStamp, appVersion: string): ExportFile {
  const { reminderDismissedAtUtc } = data.meta; // meta.persist is a fact about THIS browser, not exported
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: stamp.atUtc,
    exportedLocalDate: stamp.localDate,
    timeZone: stamp.timeZone,
    summary: summarize(data),
    data: {
      profile: data.profile,
      settings: data.settings,
      maxEntries: data.maxEntries,
      workouts: data.workouts,
      recoveryDays: data.recoveryDays,
      favorites: data.favorites,
      recent: data.recent,
      thoughtDays: data.thoughtDays,
      active: data.active,
      rotation: data.rotation,
      meta: { lastExportAtUtc: stamp.atUtc, reminderDismissedAtUtc },
    },
  };
}

export const serializeExport = (file: ExportFile): string => `${JSON.stringify(file, null, 2)}\n`;
export const exportFileName = (localDate: LocalDate): string => `pullup-pro-backup-${localDate}.json`;

