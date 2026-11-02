import type { EventStamp, LocalDate } from './time';

export type Lang = 'en' | 'ru' | 'tr';
export const LANGS: readonly Lang[] = ['en', 'ru', 'tr'];

export type Equipment = 'bar' | 'dipBars' | 'bands' | 'rings';
export const EQUIPMENT: readonly Equipment[] = ['bar', 'dipBars', 'bands', 'rings'];

export type SessionMinutes = 10 | 20 | 30 | 45;
export const SESSION_MINUTES: readonly SessionMinutes[] = [10, 20, 30, 45];
export const DAYS_PER_WEEK = [2, 3, 4, 5, 6, 7] as const;

export type Goal = 'firstPullup' | 'morePullups' | 'muscleUp' | 'consistency' | 'strength';
export const GOALS: readonly Goal[] = ['firstPullup', 'morePullups', 'muscleUp', 'consistency', 'strength'];

export type Level = 0 | 1 | 2 | 3 | 4;
export type Pattern = 'pull' | 'push' | 'legs' | 'core' | 'mobility' | 'skill';
export type Unit = 'reps' | 'seconds';
export type Muscle =
  | 'back' | 'biceps' | 'forearms' | 'shoulders' | 'chest' | 'triceps' | 'core'
  | 'glutes' | 'quads' | 'hamstrings' | 'calves' | 'hips' | 'spine';

export const EXERCISE_IDS = [
  // pull
  'dead-hang', 'scapular-pull', 'negative-pullup', 'band-pullup', 'australian-row', 'strict-pullup',
  'chin-up', 'wide-pullup', 'archer-pullup', 'weighted-pullup', 'high-pullup',
  // push / shoulders
  'wall-pushup', 'incline-pushup', 'pushup', 'diamond-pushup', 'pike-pushup', 'parallel-dips',
  'bench-dips', 'dip-support-hold', 'handstand-wall-hold',
  // legs
  'squat', 'reverse-lunge', 'bulgarian-split-squat', 'glute-bridge', 'calf-raise', 'wall-sit',
  // core
  'dead-bug', 'hollow-hold', 'plank', 'hanging-knee-raise', 'lying-leg-raise', 'hanging-leg-raise', 'side-plank',
  // mobility / recovery
  'shoulder-dislocates', 'wall-slides', 'thoracic-extension', 'hip-flexor-stretch', 'cat-cow', 'lat-stretch', 'active-hang',
  // skill (muscle-up path)
  'straight-bar-dip', 'negative-muscle-up', 'band-muscle-up', 'muscle-up',
] as const;
export type ExerciseId = (typeof EXERCISE_IDS)[number];

/** Session types. short/light are user-chosen variants, never planned by the weekly rotation. */
export type DayType = 'pullStrength' | 'pullVolume' | 'push' | 'legsCore' | 'recovery' | 'maxTest' | 'short' | 'light';
export const DAY_TYPES: readonly DayType[] = ['pullStrength', 'pullVolume', 'push', 'legsCore', 'recovery', 'maxTest', 'short', 'light'];

export type RecoveryReason = 'tired' | 'pain' | 'ill' | 'busy';
export const RECOVERY_REASONS: readonly RecoveryReason[] = ['tired', 'pain', 'ill', 'busy'];

export type OnboardingStep = 'welcome' | 'setup1' | 'setup2' | 'setup3' | 'done';

export interface Profile {
  name: string;
  lang: Lang;
  equipment: Equipment[];
  daysPerWeek: number;
  sessionMinutes: SessionMinutes;
  goals: Goal[];
  /** First local day of the program (weeks are counted from its Monday). */
  startDate: LocalDate;
  createdAtUtc: string;
  onboarding: OnboardingStep;
}

export interface Settings {
  sound: boolean;
  vibration: boolean;
}

/** Self-reported strict pull-up max (setup answer or explicit update in YOU). */
export interface MaxEntry extends EventStamp {
  value: number;
  source: 'setup' | 'self';
}

export type ExerciseRole = 'main' | 'secondary' | 'accessory' | 'warmup' | 'test' | 'cooldown';

export interface PlannedExercise {
  exerciseId: ExerciseId;
  /** Stable progression key, e.g. "pullStrength.main" (double progression is tracked per slot). */
  slot: string;
  sets: number;
  /** Reps or seconds per set (for test sets: the current max, as a reference only). */
  target: number;
  restSec: number;
  role: ExerciseRole;
}

export interface WorkoutFlags {
  lighterWeek: boolean;
  returnAfterBreak: boolean;
  feelingOff: boolean;
  maxTestSuggested: boolean;
  noPullEquipment: boolean;
  painRecently: boolean;
}

export interface Workout {
  localDate: LocalDate;
  type: DayType;
  level: Level;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  muscles: Muscle[];
  flags: WorkoutFlags;
}

export interface LoggedSet {
  target: number;
  actual: number;
  status: 'done' | 'skipped';
  atUtc: string;
}

export interface LoggedExercise {
  exerciseId: ExerciseId;
  slot: string;
  unit: Unit;
  role: ExerciseRole;
  target: number;
  plannedSets: number;
  restSec: number;
  sets: LoggedSet[];
  swappedFrom: ExerciseId | null;
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface CompletedWorkout {
  id: string;
  type: DayType;
  level: Level;
  startedAtUtc: string;
  completedAtUtc: string;
  /** Local date when the workout STARTED (DECISIONS D6). */
  localDate: LocalDate;
  timeZone: string | null;
  durationSec: number;
  exercises: LoggedExercise[];
  flags: WorkoutFlags;
  mood: Mood | null;
  note: string;
  finishedEarly: boolean;
}

/**
 * How a session was started: planned = the rotation (light on rest days) ·
 * short = 10-min block · light = technique + mobility · maxTest = the optional
 * test · early = the next planned workout, brought forward to a rest day.
 */
export type SessionVariant = 'planned' | 'short' | 'light' | 'maxTest' | 'early';

export interface ActiveSession {
  id: string;
  variant: SessionVariant;
  plan: Workout;
  startedAtUtc: string;
  localDate: LocalDate;
  timeZone: string | null;
  exIndex: number;
  setIndex: number;
  phase: 'exercise' | 'rest';
  restEndsAtUtc: string | null;
  restTotalSec: number;
  pausedAtUtc: string | null;
  /** Seconds of rest left when paused during rest. */
  pausedRestLeftSec: number | null;
  /** Total paused time (excluded from the workout duration). */
  pausedSec: number;
  /** Start of the running hold timer for time-based exercises. */
  holdStartedAtUtc: string | null;
  log: LoggedExercise[];
  feelingOff: boolean;
  restCount: number;
  warmupDone: number[];
}

export interface RecoveryDay extends EventStamp {
  reason: RecoveryReason | null;
}

export interface ThoughtDay {
  localDate: LocalDate;
  thoughtId: string;
  atUtc: string;
}

export interface RecentThought {
  id: string;
  atUtc: string;
}

export interface Meta {
  persist: 'granted' | 'denied' | 'unsupported' | null;
  lastExportAtUtc: string | null;
  reminderDismissedAtUtc: string | null;
}

export const DEFAULT_SETTINGS: Settings = { sound: false, vibration: true };
export const DEFAULT_META: Meta = { persist: null, lastExportAtUtc: null, reminderDismissedAtUtc: null };

export interface AppData {
  profile: Profile | null;
  settings: Settings;
  meta: Meta;
  active: ActiveSession | null;
  favorites: string[];
  recent: RecentThought[];
  maxEntries: MaxEntry[];
  workouts: CompletedWorkout[];
  recoveryDays: RecoveryDay[];
  thoughtDays: ThoughtDay[];
}

export function emptyAppData(): AppData {
  return {
    profile: null,
    settings: { ...DEFAULT_SETTINGS },
    meta: { ...DEFAULT_META },
    active: null,
    favorites: [],
    recent: [],
    maxEntries: [],
    workouts: [],
    recoveryDays: [],
    thoughtDays: [],
  };
}
