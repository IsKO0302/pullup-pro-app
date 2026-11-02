/**
 * Import of an export file (spec §8): schema validation, migration of older
 * files, merge / replace / reset. Pure — nothing is written here; changes are
 * applied atomically (with a snapshot first) by `repo.applyWithSnapshot`.
 */
import {
  DAY_TYPES, DAYS_PER_WEEK, DEFAULT_SETTINGS, EQUIPMENT, EXERCISE_IDS, EXERCISE_ROLES, GOALS, LANGS, MOODS, MUSCLES,
  ONBOARDING_STEPS, RECOVERY_REASONS, SESSION_MINUTES, SESSION_VARIANTS, UNITS, emptyAppData,
  type ActiveSession, type AppData, type CompletedWorkout, type Level, type LoggedExercise, type LoggedSet, type MaxEntry,
  type Meta, type PlannedExercise, type Profile, type RecentThought, type RecoveryDay, type RhythmChange, type Settings,
  type ThoughtDay, type Workout, type WorkoutFlags,
} from '../domain/types';
import type { LocalDate } from '../domain/time';
import { SCHEMA_VERSION } from './db';
import { EXPORT_FORMAT, summarize, type ExportData, type ExportFile } from './exportFile';
import { sortWorkouts } from './repo';

/** Same cap as the "recently viewed" list in the app. */
const RECENT_LIMIT = 30;

// ── Older files ──────────────────────────────────────────────────────────────

export interface FileMigration {
  /** The schema version this step upgrades TO (mirrors the database migrations). */
  version: number;
  description: string;
  up: (data: Record<string, unknown>) => Record<string, unknown>;
}

export const FILE_MIGRATIONS: readonly FileMigration[] = [
  {
    version: 2,
    description: 'v1 → v2: workouts.timeZone (null when unknown) and thoughtDays.',
    up: (d) => ({
      ...d,
      workouts: Array.isArray(d.workouts)
        ? d.workouts.map((w: unknown) => (isObj(w) && w.timeZone === undefined ? { ...w, timeZone: null } : w))
        : d.workouts,
      thoughtDays: d.thoughtDays ?? [],
    }),
  },
];

export function migrateFileData(data: Record<string, unknown>, fromVersion: number, migrations: readonly FileMigration[] = FILE_MIGRATIONS): Record<string, unknown> {
  return migrations.filter((m) => m.version > fromVersion).reduce((d, m) => m.up(d), data);
}

// ── Schema validation ────────────────────────────────────────────────────────

class Invalid extends Error {
  readonly path: string;
  constructor(path: string, why: string) {
    super(`${path}: ${why}`);
    this.path = path;
  }
}

type Check<T> = (v: unknown, path: string) => T;
type Shape<T> = { [K in keyof T]-?: Check<T[K]> };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const text = (max: number): Check<string> => (v, p) => {
  if (typeof v !== 'string' || v.length > max) throw new Invalid(p, 'expected text');
  return v;
};
const bool: Check<boolean> = (v, p) => {
  if (typeof v !== 'boolean') throw new Invalid(p, 'expected true/false');
  return v;
};
const int = (min: number, max: number): Check<number> => (v, p) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Invalid(p, `expected a whole number ${min}–${max}`);
  return v;
};
const num = (min: number, max: number): Check<number> => (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Invalid(p, `expected a number ${min}–${max}`);
  return v;
};
const oneOf = <T extends string | number>(list: readonly T[]): Check<T> => (v, p) => {
  if (!list.includes(v as T)) throw new Invalid(p, 'unknown value');
  return v as T;
};
const nullable = <T>(c: Check<T>): Check<T | null> => (v, p) => (v === null ? null : c(v, p));
/** Missing (undefined) → a fresh copy of `fallback`; present but wrong → invalid. */
const or = <T>(c: Check<T>, fallback: T): Check<T> => (v, p) => (v === undefined ? structuredClone(fallback) : c(v, p));
const optional = <T>(c: Check<T>): Check<T | undefined> => (v, p) => (v === undefined ? undefined : c(v, p));
const list = <T>(c: Check<T>, max = 200_000): Check<T[]> => (v, p) => {
  if (!Array.isArray(v) || v.length > max) throw new Invalid(p, 'expected a list');
  return v.map((x, i) => c(x, `${p}[${i}]`));
};
function shape<T>(fields: Shape<T>): Check<T> {
  return (v, p) => {
    if (!isObj(v)) throw new Invalid(p, 'expected an object');
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(fields) as (keyof T & string)[]) {
      const value = fields[key](v[key], p ? `${p}.${key}` : key);
      if (value !== undefined) out[key] = value; // unknown keys are dropped, absent optionals stay absent
    }
    return out as T;
  };
}
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const utc: Check<string> = (v, p) => {
  if (typeof v !== 'string' || !ISO_UTC.test(v) || !Number.isFinite(Date.parse(v))) throw new Invalid(p, 'expected a UTC time');
  return v;
};
const localDate: Check<LocalDate> = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    throw new Invalid(p, 'expected a calendar date');
  }
  return v;
};
const id = text(200);
const timeZone = or(nullable(text(100)), null);
const level = int(0, 4) as Check<Level>;
const uniqueBy = <T>(c: Check<T[]>, key: (x: T) => string): Check<T[]> => (v, p) => {
  const items = c(v, p);
  const seen = new Set<string>();
  items.forEach((x, i) => {
    const k = key(x);
    if (seen.has(k)) throw new Invalid(`${p}[${i}]`, 'duplicate entry');
    seen.add(k);
  });
  return items;
};

const rhythmChange = shape<RhythmChange>({ from: localDate, daysPerWeek: oneOf(DAYS_PER_WEEK) });
const profile = shape<Profile>({
  name: or(text(200), ''),
  lang: oneOf(LANGS),
  equipment: or(list(oneOf(EQUIPMENT), 20), []),
  daysPerWeek: oneOf(DAYS_PER_WEEK),
  sessionMinutes: oneOf(SESSION_MINUTES),
  goals: or(list(oneOf(GOALS), 20), []),
  startDate: localDate,
  createdAtUtc: utc,
  onboarding: oneOf(ONBOARDING_STEPS),
  rhythmChanges: optional(list(rhythmChange, 10_000)),
});
const settings = shape<Settings>({ sound: or(bool, DEFAULT_SETTINGS.sound), vibration: or(bool, DEFAULT_SETTINGS.vibration) });
const flags = shape<WorkoutFlags>({
  lighterWeek: or(bool, false), returnAfterBreak: or(bool, false), feelingOff: or(bool, false),
  maxTestSuggested: or(bool, false), noPullEquipment: or(bool, false), painRecently: or(bool, false),
});
const loggedSet = shape<LoggedSet>({ target: num(0, 100_000), actual: num(0, 100_000), status: oneOf(['done', 'skipped'] as const), atUtc: utc });
const loggedExercise = shape<LoggedExercise>({
  exerciseId: oneOf(EXERCISE_IDS),
  slot: text(200),
  unit: oneOf(UNITS),
  role: oneOf(EXERCISE_ROLES),
  target: num(0, 100_000),
  plannedSets: int(0, 1000),
  restSec: num(0, 86_400),
  sets: list(loggedSet, 1000),
  swappedFrom: or(nullable(oneOf(EXERCISE_IDS)), null),
});
const workout = shape<CompletedWorkout>({
  id,
  type: oneOf(DAY_TYPES),
  level,
  startedAtUtc: utc,
  completedAtUtc: utc,
  localDate,
  timeZone,
  durationSec: num(0, 7 * 86_400),
  exercises: list(loggedExercise, 1000),
  flags: or(flags, flags({}, '')),
  mood: or(nullable(oneOf(MOODS)), null),
  note: or(text(20_000), ''),
  finishedEarly: or(bool, false),
});
const planned = shape<PlannedExercise>({
  exerciseId: oneOf(EXERCISE_IDS), slot: text(200), sets: int(0, 1000), target: num(0, 100_000), restSec: num(0, 86_400), role: oneOf(EXERCISE_ROLES),
});
const plan = shape<Workout>({
  localDate, type: oneOf(DAY_TYPES), level, exercises: list(planned, 1000), estimatedMinutes: num(0, 10_000),
  muscles: or(list(oneOf(MUSCLES), 100), []), flags: or(flags, flags({}, '')),
});
const active = shape<ActiveSession>({
  id,
  variant: oneOf(SESSION_VARIANTS),
  plan,
  startedAtUtc: utc,
  localDate,
  timeZone,
  exIndex: int(0, 1000),
  setIndex: int(0, 1000),
  phase: oneOf(['exercise', 'rest'] as const),
  restEndsAtUtc: or(nullable(utc), null),
  restTotalSec: num(0, 86_400),
  pausedAtUtc: or(nullable(utc), null),
  pausedRestLeftSec: or(nullable(num(0, 86_400)), null),
  pausedSec: or(num(0, 10_000_000), 0),
  holdStartedAtUtc: or(nullable(utc), null),
  log: list(loggedExercise, 1000),
  feelingOff: or(bool, false),
  restCount: or(int(0, 100_000), 0),
  warmupDone: or(list(int(0, 1000), 1000), []),
});
const maxEntry = shape<MaxEntry>({ atUtc: utc, localDate, timeZone, value: int(0, 1000), source: oneOf(['setup', 'self'] as const) });
const recoveryDay = shape<RecoveryDay>({ atUtc: utc, localDate, timeZone, reason: or(nullable(oneOf(RECOVERY_REASONS)), null) });
const thoughtDay = shape<ThoughtDay>({ localDate, thoughtId: id, atUtc: utc });
const recent = shape<RecentThought>({ id, atUtc: utc });
const fileMeta = shape<Omit<Meta, 'persist'>>({ lastExportAtUtc: or(nullable(utc), null), reminderDismissedAtUtc: or(nullable(utc), null) });

const exportData = shape<ExportData>({
  profile: or(nullable(profile), null),
  settings: or(settings, { ...DEFAULT_SETTINGS }),
  maxEntries: or(list(maxEntry), []),
  workouts: uniqueBy(or(list(workout), []), (w) => w.id),
  recoveryDays: uniqueBy(or(list(recoveryDay), []), (r) => r.localDate),
  favorites: uniqueBy(or(list(id, 10_000), []), (f) => f),
  recent: or(list(recent, 1000), []),
  thoughtDays: uniqueBy(or(list(thoughtDay), []), (t) => t.localDate),
  active: or(nullable(active), null),
  meta: or(fileMeta, { lastExportAtUtc: null, reminderDismissedAtUtc: null }),
});

export type ImportErrorCode = 'notJson' | 'notApp' | 'newer' | 'invalid';
export type ParseResult = { ok: true; file: ExportFile } | { ok: false; code: ImportErrorCode; detail: string };

/** Largest file accepted (decades of training are far below this). */
export const MAX_IMPORT_CHARS = 100_000_000;

/**
 * Parses and validates an export file. Never throws; nothing is written here.
 * Older files are migrated forward; files from a NEWER schema are refused.
 */
export function parseExport(raw: string): ParseResult {
  if (raw.length > MAX_IMPORT_CHARS) return { ok: false, code: 'invalid', detail: 'file too large' };
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, code: 'notJson', detail: '' };
  }
  if (!isObj(json) || json.format !== EXPORT_FORMAT) return { ok: false, code: 'notApp', detail: '' };
  const version = json.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, code: 'invalid', detail: 'schemaVersion' };
  if (version > SCHEMA_VERSION) return { ok: false, code: 'newer', detail: String(version) };
  try {
    if (!isObj(json.data)) throw new Invalid('data', 'expected an object');
    const data = exportData(migrateFileData(json.data, version), '');
    const file: ExportFile = {
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: or(text(50), '')(json.appVersion, 'appVersion'),
      exportedAt: utc(json.exportedAt, 'exportedAt'),
      exportedLocalDate: or(localDate, '')(json.exportedLocalDate, 'exportedLocalDate') || String(json.exportedAt).slice(0, 10),
      timeZone: timeZone(json.timeZone, 'timeZone'),
      summary: summarize(data),
      data: { ...data, workouts: sortWorkouts(data.workouts), recoveryDays: byDate(data.recoveryDays), thoughtDays: byDate(data.thoughtDays) },
    };
    return { ok: true, file };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, code: 'invalid', detail: err.path };
    return { ok: false, code: 'invalid', detail: String(err) };
  }
}

// ── Applying ─────────────────────────────────────────────────────────────────

export type ImportMode = 'merge' | 'replace';

const byDate = <T extends { localDate: LocalDate }>(items: readonly T[]): T[] => [...items].sort((a, b) => a.localDate.localeCompare(b.localDate));

function unionBy<T>(mine: readonly T[], theirs: readonly T[], key: (x: T) => string): T[] {
  const seen = new Set(mine.map(key));
  return [...mine, ...theirs.filter((x) => !seen.has(key(x)))];
}

/** Replace: this browser gets exactly the file's data; only device facts (storage protection) stay. */
export function replaceWith(current: AppData, incoming: ExportData): AppData {
  return { ...incoming, meta: { ...incoming.meta, persist: current.meta.persist } };
}

/**
 * Merge: adds what is missing here and never overwrites anything on this
 * device. Same workout id / same local date → this device's record wins
 * (so today's pinned thought and edited notes stay as they are).
 */
export function mergeInto(current: AppData, incoming: ExportData): AppData {
  const hasProfile = current.profile?.onboarding === 'done';
  const recentById = new Map<string, RecentThought>();
  for (const r of [...current.recent, ...incoming.recent]) {
    const seen = recentById.get(r.id);
    if (!seen || r.atUtc > seen.atUtc) recentById.set(r.id, r);
  }
  return {
    profile: hasProfile ? current.profile : (incoming.profile ?? current.profile),
    settings: hasProfile ? current.settings : incoming.settings,
    meta: current.meta,
    active: current.active,
    favorites: unionBy(current.favorites, incoming.favorites, (f) => f),
    recent: [...recentById.values()].sort((a, b) => b.atUtc.localeCompare(a.atUtc)).slice(0, RECENT_LIMIT),
    maxEntries: unionBy(current.maxEntries, incoming.maxEntries, (m) => `${m.atUtc}|${m.source}|${m.value}`).sort((a, b) => a.atUtc.localeCompare(b.atUtc)),
    workouts: sortWorkouts(unionBy(current.workouts, incoming.workouts, (w) => w.id)),
    recoveryDays: byDate(unionBy(current.recoveryDays, incoming.recoveryDays, (r) => r.localDate)),
    thoughtDays: byDate(unionBy(current.thoughtDays, incoming.thoughtDays, (t) => t.localDate)),
  };
}

/** Workouts in the file that this device does not have yet (what "merge" adds). */
export function newWorkoutsIn(current: Pick<AppData, 'workouts'>, incoming: Pick<ExportData, 'workouts'>): number {
  const ids = new Set(current.workouts.map((w) => w.id));
  return incoming.workouts.filter((w) => !ids.has(w.id)).length;
}

/** Reset: back to a first launch. Storage protection is a fact about this browser, so it stays. */
export function resetData(current: AppData): AppData {
  const data = emptyAppData();
  data.meta.persist = current.meta.persist;
  return data;
}

/**
 * A snapshot goes through the same validation + migration as a file, so a copy
 * taken under an older schema is upgraded before it is restored.
 */
export function parseSnapshot(snapshot: { atUtc: string; schemaVersion: number; data: unknown }): ParseResult {
  return parseExport(JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: snapshot.schemaVersion, exportedAt: snapshot.atUtc, data: snapshot.data }));
}
