import type { DayType, ExerciseId, ExerciseRole, Level } from './types';

/**
 * Slot tables: what a session is made of, per day type and level.
 * Each slot lists options in preference order; the first one the user can do
 * (equipment, level, not optional, not already used) is chosen.
 * Targets: `fromMax` = fraction of the strict max (rounded down, min 1,
 * capped) — sets are submaximal, 2–3 reps in reserve (guardrail 4). A strict
 * option that cannot keep that reserve is skipped, so every strict main lists
 * assisted fallbacks (DECISIONS D62). Negatives need a box and a controlled
 * descent first (D61).
 */
export interface SlotOption {
  id: ExerciseId;
  /** Base target (reps or seconds). Defaults to the catalog `start`. */
  target?: number;
  fromMax?: number;
  cap?: number;
}

export interface SlotSpec {
  key: string;
  role: ExerciseRole;
  options: readonly SlotOption[];
  sets: number;
  minSets: number;
  maxSets: number;
  restSec: number;
  /** Double progression on/off (mobility and test slots stay fixed). */
  progress: boolean;
  /** Harder/easier variation steps (off for the strict pull-up family: level drives it). */
  vary: boolean;
}

const o = (id: ExerciseId, target?: number, fromMax?: number, cap?: number): SlotOption => ({ id, target, fromMax, cap });
const s = (key: string, role: ExerciseRole, options: SlotOption[], sets: number, range: [number, number], restSec: number, flags: { progress?: boolean; vary?: boolean } = {}): SlotSpec => ({
  key, role, options, sets, minSets: range[0], maxSets: range[1], restSec, progress: flags.progress ?? true, vary: flags.vary ?? true,
});
const strict = (fromMax: number, cap: number) => o('strict-pullup', 1, fromMax, cap);
/** Fallbacks of a strict main when no strict set with reserve is possible today. */
const assisted = (reps: number): SlotOption[] => [
  o('band-pullup', reps, undefined, 8), o('feet-assisted-pullup', reps, undefined, 8), o('negative-pullup', 3, undefined, 5), o('australian-row', 8, undefined, 12),
];
const assistedVolume = (reps: number): SlotOption[] => [
  o('band-pullup', reps, undefined, 12), o('feet-assisted-pullup', reps, undefined, 12), o('australian-row', 10, undefined, 15),
];

type Table = Readonly<Record<Level, readonly SlotSpec[]>>;

export const PULL_STRENGTH: Table = {
  0: [
    s('main', 'main', [o('negative-pullup', 2, undefined, 5), o('feet-assisted-pullup', 5, undefined, 8), o('band-pullup', 5, undefined, 8), o('australian-row', 6, undefined, 12)], 3, [2, 5], 120, { vary: false }),
    s('assist', 'secondary', [o('band-pullup', 5), o('feet-assisted-pullup', 5), o('scapular-pull', 6)], 3, [2, 4], 90),
    s('row', 'accessory', [o('australian-row', 6)], 3, [2, 4], 75),
    s('hang', 'accessory', [o('supported-hang', 20, undefined, 30), o('dead-hang', 20)], 2, [1, 3], 60),
    s('core', 'accessory', [o('dead-bug', 8)], 2, [1, 3], 45),
  ],
  1: [
    s('main', 'main', [strict(0.6, 8), ...assisted(5)], 4, [2, 6], 150, { vary: false }),
    s('neg', 'secondary', [o('negative-pullup', 3), o('feet-assisted-pullup', 5), o('scapular-pull', 8)], 3, [2, 4], 120, { vary: false }),
    s('assist', 'accessory', [o('band-pullup', 6), o('australian-row', 8)], 3, [2, 4], 90),
    s('hang', 'accessory', [o('dead-hang', 25)], 2, [1, 3], 60),
    s('core', 'accessory', [o('lying-leg-raise', 8), o('dead-bug', 8)], 2, [1, 3], 45),
  ],
  2: [
    s('main', 'main', [strict(0.6, 8), ...assisted(6)], 5, [2, 6], 150, { vary: false }),
    s('sec', 'secondary', [o('chin-up', 2, 0.5, 8)], 3, [2, 4], 120, { vary: false }),
    s('row', 'accessory', [o('australian-row', 8)], 3, [2, 4], 75),
    s('core', 'accessory', [o('hanging-knee-raise', 8), o('lying-leg-raise', 10)], 2, [1, 3], 60),
  ],
  3: [
    s('main', 'main', [strict(0.6, 8), ...assisted(6)], 5, [3, 6], 150, { vary: false }),
    s('sec', 'secondary', [o('wide-pullup', 3, 0.45, 8), o('chin-up', 3, 0.5, 8)], 3, [2, 4], 120, { vary: false }),
    s('row', 'accessory', [o('australian-row', 10)], 3, [2, 4], 75),
    s('core', 'accessory', [o('hanging-leg-raise', 6), o('hanging-knee-raise', 10)], 3, [1, 3], 60),
  ],
  4: [
    s('main', 'main', [strict(0.6, 8), ...assisted(6)], 5, [3, 6], 150, { vary: false }),
    s('sec', 'secondary', [o('archer-pullup', 3), o('wide-pullup', 4, 0.4, 10), o('chin-up', 4, 0.45, 10)], 3, [2, 4], 150, { vary: false }),
    s('power', 'accessory', [o('high-pullup', 4)], 3, [2, 4], 120, { vary: false }),
    s('row', 'accessory', [o('australian-row', 12)], 3, [2, 4], 60),
    s('core', 'accessory', [o('hanging-leg-raise', 10), o('hollow-hold', 40)], 3, [1, 3], 60),
  ],
};

export const PULL_VOLUME: Table = {
  0: [
    s('main', 'main', [o('band-pullup', 6, undefined, 12), o('feet-assisted-pullup', 6, undefined, 12), o('australian-row', 8, undefined, 15)], 4, [2, 6], 75, { vary: false }),
    s('neg', 'secondary', [o('negative-pullup', 2, undefined, 5), o('feet-assisted-pullup', 4), o('scapular-pull', 6)], 3, [2, 4], 90, { vary: false }),
    s('scap', 'accessory', [o('scapular-pull', 8), o('active-hang', 15)], 3, [2, 4], 60),
    s('row', 'accessory', [o('australian-row', 8)], 3, [2, 4], 60),
    s('hang', 'accessory', [o('supported-hang', 20, undefined, 30), o('dead-hang', 20)], 3, [1, 4], 60),
    s('core', 'accessory', [o('dead-bug', 8)], 2, [1, 3], 45),
  ],
  1: [
    s('main', 'main', [strict(0.5, 10), ...assistedVolume(6)], 5, [3, 8], 90, { vary: false }),
    s('assist', 'secondary', [o('band-pullup', 5), o('negative-pullup', 3), o('feet-assisted-pullup', 5), o('dead-hang', 25)], 3, [2, 4], 90),
    s('row', 'accessory', [o('australian-row', 8)], 3, [2, 4], 60),
    s('scap', 'accessory', [o('scapular-pull', 8)], 2, [1, 3], 60),
    s('core', 'accessory', [o('dead-bug', 8)], 2, [1, 3], 45),
  ],
  2: [
    s('main', 'main', [strict(0.5, 10), ...assistedVolume(8)], 6, [3, 8], 90, { vary: false }),
    s('sec', 'secondary', [o('chin-up', 2, 0.45, 10)], 3, [2, 4], 90, { vary: false }),
    s('row', 'accessory', [o('australian-row', 10)], 3, [2, 4], 60),
    s('core', 'accessory', [o('hanging-knee-raise', 8), o('lying-leg-raise', 10)], 3, [1, 3], 60),
  ],
  3: [
    s('main', 'main', [strict(0.5, 10), ...assistedVolume(8)], 6, [3, 8], 90, { vary: false }),
    s('sec', 'secondary', [o('chin-up', 3, 0.45, 10), o('wide-pullup', 3, 0.4, 10)], 3, [2, 4], 90, { vary: false }),
    s('row', 'accessory', [o('australian-row', 12)], 3, [2, 4], 60),
    s('core', 'accessory', [o('hanging-leg-raise', 8), o('hanging-knee-raise', 10)], 3, [1, 3], 60),
  ],
  4: [
    s('main', 'main', [strict(0.5, 10), ...assistedVolume(8)], 6, [3, 8], 90, { vary: false }),
    s('sec', 'secondary', [o('wide-pullup', 4, 0.4, 10), o('chin-up', 4, 0.45, 10)], 3, [2, 4], 90, { vary: false }),
    s('row', 'accessory', [o('australian-row', 12)], 3, [2, 4], 60),
    s('core', 'accessory', [o('hanging-leg-raise', 10), o('hollow-hold', 40)], 3, [1, 3], 60),
  ],
};

export const PUSH: Table = {
  0: [
    s('main', 'main', [o('incline-pushup', 8), o('wall-pushup', 10)], 3, [2, 6], 75),
    s('sec', 'secondary', [o('wall-pushup', 12)], 2, [1, 4], 60),
    s('shoulder', 'accessory', [o('wall-slides', 10)], 2, [1, 4], 45, { progress: false }),
    s('core', 'accessory', [o('plank', 20)], 2, [1, 4], 45),
    s('glutes', 'accessory', [o('glute-bridge', 12)], 2, [1, 4], 45),
  ],
  1: [
    s('main', 'main', [o('pushup', 6), o('incline-pushup', 10)], 3, [2, 6], 90),
    s('sec', 'secondary', [o('dip-support-hold', 15), o('incline-pushup', 10)], 3, [2, 4], 75),
    s('shoulder', 'accessory', [o('wall-slides', 10)], 2, [1, 4], 45, { progress: false }),
    s('core', 'accessory', [o('plank', 25)], 2, [1, 4], 45),
    s('glutes', 'accessory', [o('glute-bridge', 12)], 2, [1, 4], 45),
  ],
  2: [
    s('main', 'main', [o('parallel-dips', 5), o('pushup', 10)], 4, [2, 6], 90),
    s('sec', 'secondary', [o('pike-pushup', 6)], 3, [2, 4], 90),
    s('third', 'accessory', [o('diamond-pushup', 6), o('pushup', 10)], 3, [2, 4], 75),
    s('shoulder', 'accessory', [o('wall-slides', 10)], 2, [1, 4], 45, { progress: false }),
    s('core', 'accessory', [o('plank', 30)], 2, [1, 4], 45),
  ],
  3: [
    s('main', 'main', [o('parallel-dips', 8), o('diamond-pushup', 10)], 4, [2, 6], 90),
    s('sec', 'secondary', [o('pike-pushup', 8)], 3, [2, 4], 90),
    s('third', 'accessory', [o('pushup', 15), o('diamond-pushup', 10)], 3, [2, 4], 75),
    s('hold', 'accessory', [o('handstand-wall-hold', 20)], 3, [1, 4], 75),
    s('shoulder', 'accessory', [o('wall-slides', 10)], 2, [1, 4], 45, { progress: false }),
  ],
  4: [
    s('main', 'main', [o('parallel-dips', 10), o('diamond-pushup', 12)], 4, [2, 6], 90),
    s('sec', 'secondary', [o('pike-pushup', 10)], 3, [2, 4], 90),
    s('hold', 'accessory', [o('handstand-wall-hold', 30)], 3, [1, 4], 75),
    s('third', 'accessory', [o('diamond-pushup', 12), o('pushup', 20)], 3, [2, 4], 60),
    s('shoulder', 'accessory', [o('wall-slides', 10)], 2, [1, 4], 45, { progress: false }),
  ],
};

export const LEGS_CORE: Table = {
  0: [
    s('legs', 'main', [o('squat', 10)], 3, [2, 6], 60),
    s('glutes', 'secondary', [o('glute-bridge', 12)], 3, [2, 4], 60),
    s('core', 'secondary', [o('dead-bug', 8)], 3, [2, 4], 45),
    s('core2', 'accessory', [o('plank', 20)], 2, [1, 4], 45),
    s('calves', 'accessory', [o('calf-raise', 15)], 2, [1, 4], 45),
    s('hold', 'accessory', [o('wall-sit', 30)], 2, [1, 3], 60),
  ],
  1: [
    s('legs', 'main', [o('squat', 15)], 3, [2, 6], 60),
    s('lunge', 'secondary', [o('reverse-lunge', 8)], 3, [2, 4], 60),
    s('core', 'secondary', [o('hollow-hold', 20), o('dead-bug', 10)], 3, [2, 4], 45),
    s('core2', 'accessory', [o('hanging-knee-raise', 8), o('lying-leg-raise', 8)], 3, [1, 4], 60),
    s('glutes', 'accessory', [o('glute-bridge', 15)], 2, [1, 4], 45),
    s('side', 'accessory', [o('side-plank', 20)], 2, [1, 3], 45),
    s('calves', 'accessory', [o('calf-raise', 15)], 2, [1, 3], 45),
  ],
  2: [
    s('legs', 'main', [o('bulgarian-split-squat', 8)], 3, [2, 5], 75),
    s('legs2', 'secondary', [o('squat', 20)], 3, [2, 4], 60),
    s('core', 'secondary', [o('hollow-hold', 25)], 3, [2, 4], 45),
    s('core2', 'accessory', [o('hanging-knee-raise', 10), o('lying-leg-raise', 10)], 3, [1, 4], 60),
    s('glutes', 'accessory', [o('glute-bridge', 15)], 2, [1, 4], 45),
    s('side', 'accessory', [o('side-plank', 25)], 2, [1, 3], 45),
    s('calves', 'accessory', [o('calf-raise', 20)], 2, [1, 3], 45),
  ],
  3: [
    s('legs', 'main', [o('bulgarian-split-squat', 10)], 3, [2, 5], 75),
    s('lunge', 'secondary', [o('reverse-lunge', 12)], 3, [2, 4], 60),
    s('core', 'secondary', [o('hanging-leg-raise', 8), o('hanging-knee-raise', 10)], 3, [2, 4], 60),
    s('core2', 'accessory', [o('hollow-hold', 30)], 3, [1, 4], 45),
    s('hold', 'accessory', [o('wall-sit', 45)], 2, [1, 3], 60),
    s('side', 'accessory', [o('side-plank', 30)], 2, [1, 3], 45),
    s('calves', 'accessory', [o('calf-raise', 20)], 2, [1, 3], 45),
  ],
  4: [
    s('legs', 'main', [o('bulgarian-split-squat', 12)], 4, [2, 5], 75),
    s('lunge', 'secondary', [o('reverse-lunge', 12)], 3, [2, 4], 60),
    s('core', 'secondary', [o('hanging-leg-raise', 12), o('plank', 45)], 3, [2, 4], 60),
    s('core2', 'accessory', [o('hollow-hold', 40)], 3, [1, 4], 45),
    s('hold', 'accessory', [o('wall-sit', 60)], 2, [1, 3], 60),
    s('side', 'accessory', [o('side-plank', 40)], 2, [1, 3], 45),
    s('calves', 'accessory', [o('calf-raise', 25)], 2, [1, 3], 45),
  ],
};

/** Always light: 10–20 minutes, fixed targets, short rests. */
export const RECOVERY: readonly SlotSpec[] = [
  s('spine', 'main', [o('cat-cow', 8)], 2, [1, 3], 20, { progress: false }),
  s('thoracic', 'secondary', [o('thoracic-extension', 6)], 2, [1, 3], 20, { progress: false }),
  s('shoulder', 'secondary', [o('wall-slides', 10)], 2, [1, 3], 20, { progress: false }),
  s('lats', 'accessory', [o('lat-stretch', 30)], 2, [1, 3], 20, { progress: false }),
  s('hips', 'accessory', [o('hip-flexor-stretch', 30)], 2, [1, 3], 20, { progress: false }),
  s('hang', 'accessory', [o('active-hang', 20)], 2, [1, 3], 30, { progress: false }),
  s('core', 'accessory', [o('dead-bug', 6)], 2, [1, 2], 20, { progress: false }),
  s('glutes', 'accessory', [o('glute-bridge', 10)], 1, [1, 2], 20, { progress: false }),
];

/** Extra session after the day's workout or on a rest day: technique + mobility only. */
export const LIGHT: readonly SlotSpec[] = [
  s('scap', 'main', [o('scapular-pull', 5), o('wall-slides', 10)], 2, [1, 3], 45, { progress: false }),
  s('hang', 'secondary', [o('active-hang', 15)], 2, [1, 2], 30, { progress: false }),
  s('shoulder', 'accessory', [o('wall-slides', 8)], 2, [1, 2], 30, { progress: false }),
  s('spine', 'accessory', [o('cat-cow', 8)], 1, [1, 2], 20, { progress: false }),
  s('lats', 'accessory', [o('lat-stretch', 30)], 2, [1, 2], 20, { progress: false }),
  s('hips', 'accessory', [o('hip-flexor-stretch', 30)], 1, [1, 2], 20, { progress: false }),
];

/** Small accessories that keep 2–3-day weeks balanced (appended, trimmed first). */
export function balanceSlots(type: DayType, level: Level): SlotSpec[] {
  const pushMain = PUSH[level][0]!;
  const legsMain = LEGS_CORE[level][0]!;
  const coreMain = LEGS_CORE[level].find((x) => x.key === 'core')!;
  const extra = (key: string, from: SlotSpec): SlotSpec => ({ ...from, key: `bal-${key}`, role: 'accessory', sets: 2, minSets: 1, maxSets: 3 });
  if (type === 'pullStrength') return [extra('push', pushMain), extra('legs', legsMain)];
  if (type === 'pullVolume') return [extra('legs', legsMain), extra('core', coreMain)];
  if (type === 'push') return [extra('row', PULL_VOLUME[level].find((x) => x.key === 'row') ?? PULL_VOLUME[1].find((x) => x.key === 'row')!), extra('legs', legsMain), extra('core', coreMain)];
  return [];
}

/** Muscle-up skill work by path stage (L4, or L3 with the muscle-up goal). */
export function skillSlot(stage: number): SlotSpec {
  const options: SlotOption[] =
    stage <= 2 ? [o('high-pullup', 3)]
    : stage === 3 ? [o('straight-bar-dip', 5), o('high-pullup', 3)]
    : stage === 4 ? [o('negative-muscle-up', 2), o('straight-bar-dip', 6)]
    : stage === 5 ? [o('band-muscle-up', 3), o('negative-muscle-up', 3)]
    : [o('muscle-up', 1), o('band-muscle-up', 3)];
  return s('skill', 'accessory', options, 3, [2, 4], 120, { vary: false });
}
