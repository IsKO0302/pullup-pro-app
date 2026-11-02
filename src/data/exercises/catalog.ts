import type { Equipment, ExerciseId, Level, Muscle, Pattern, Unit } from '../../domain/types';

/**
 * Exercise catalog. Texts (name, 3 cues, common mistake, safety) live in
 * the per-language files text.<lang>.ts. Cues are general guidance and should
 * be reviewed by the owner (DECISIONS D15).
 */
export interface ExerciseDef {
  id: ExerciseId;
  pattern: Pattern;
  unit: Unit;
  /** Levels at which the engine may prescribe it. */
  levelRange: readonly [Level, Level];
  /** Any-of list of all-of equipment sets. `[[]]` = no equipment needed. */
  equipment: readonly (readonly Equipment[])[];
  muscles: readonly Muscle[];
  easier: readonly ExerciseId[];
  harder: readonly ExerciseId[];
  /** Same-purpose options offered by "Swap" (filtered by equipment). */
  alternatives: readonly ExerciseId[];
  /** Seconds per rep (reps) — used for duration estimates. */
  secPerRep: number;
  /** Typical first target (reps or seconds) when this variation is introduced. */
  start: number;
  /** Highest target the engine ever plans for this variation (quality limit, e.g. slow negatives). */
  ceiling?: number;
  /** Reps/seconds are per side (time doubles). */
  perSide?: true;
  /** Never auto-prescribed; only reachable through Swap, with a safety note (guardrail 4). */
  optional?: true;
  /**
   * Record family. 'pullup' = strict, unassisted pull-up variations (count toward
   * pull-up totals). Only `strict-pullup` itself defines the pull-up max (guardrail 6).
   */
  family?: 'pullup' | 'assisted' | 'negative' | 'muscleup';
}

const NONE: readonly (readonly Equipment[])[] = [[]];
const BAR: readonly (readonly Equipment[])[] = [['bar']];
const BAR_OR_RINGS: readonly (readonly Equipment[])[] = [['bar'], ['rings']];
/** Feet on a stable box under the bar, or on the floor under low rings. */
const FEET_SUPPORTED: readonly (readonly Equipment[])[] = [['bar', 'box'], ['rings']];
/** Negatives start at the top: step up from a stable box, never jump (DECISIONS D61). */
const BOX_TO_TOP: readonly (readonly Equipment[])[] = [['bar', 'box'], ['rings', 'box']];

const list: ExerciseDef[] = [
  // ── pull ─────────────────────────────────────────────────────────────
  { id: 'dead-hang', start: 20, pattern: 'pull', unit: 'seconds', levelRange: [0, 2], equipment: BAR_OR_RINGS, muscles: ['forearms', 'back', 'shoulders'], easier: ['supported-hang'], harder: ['scapular-pull'], alternatives: ['active-hang', 'scapular-pull'], secPerRep: 1 },
  { id: 'scapular-pull', start: 6, pattern: 'pull', unit: 'reps', levelRange: [0, 2], equipment: BAR_OR_RINGS, muscles: ['back', 'shoulders'], easier: ['dead-hang'], harder: ['feet-assisted-pullup', 'negative-pullup'], alternatives: ['dead-hang', 'australian-row'], secPerRep: 3 },
  { id: 'negative-pullup', start: 3, pattern: 'pull', unit: 'reps', levelRange: [0, 2], equipment: BOX_TO_TOP, muscles: ['back', 'biceps', 'forearms'], easier: ['feet-assisted-pullup', 'scapular-pull', 'band-pullup'], harder: ['strict-pullup'], alternatives: ['feet-assisted-pullup', 'band-pullup', 'australian-row'], secPerRep: 8, ceiling: 5, family: 'negative' },
  { id: 'band-pullup', start: 5, pattern: 'pull', unit: 'reps', levelRange: [0, 2], equipment: [['bar', 'bands']], muscles: ['back', 'biceps'], easier: ['australian-row'], harder: ['strict-pullup'], alternatives: ['negative-pullup', 'australian-row'], secPerRep: 4, family: 'assisted' },
  { id: 'australian-row', start: 8, pattern: 'pull', unit: 'reps', levelRange: [0, 4], equipment: BAR_OR_RINGS, muscles: ['back', 'biceps', 'shoulders'], easier: [], harder: ['feet-assisted-pullup', 'negative-pullup'], alternatives: ['band-pullup', 'scapular-pull'], secPerRep: 3 },
  { id: 'strict-pullup', start: 3, pattern: 'pull', unit: 'reps', levelRange: [1, 4], equipment: BAR_OR_RINGS, muscles: ['back', 'biceps', 'forearms'], easier: ['band-pullup', 'feet-assisted-pullup', 'negative-pullup'], harder: ['wide-pullup', 'archer-pullup', 'weighted-pullup'], alternatives: ['chin-up', 'band-pullup', 'feet-assisted-pullup', 'negative-pullup'], secPerRep: 4, family: 'pullup' },
  { id: 'chin-up', start: 3, pattern: 'pull', unit: 'reps', levelRange: [1, 4], equipment: BAR_OR_RINGS, muscles: ['back', 'biceps'], easier: ['band-pullup', 'feet-assisted-pullup', 'negative-pullup'], harder: ['weighted-pullup'], alternatives: ['strict-pullup', 'australian-row'], secPerRep: 4, family: 'pullup' },
  { id: 'wide-pullup', start: 4, pattern: 'pull', unit: 'reps', levelRange: [3, 4], equipment: BAR, muscles: ['back', 'shoulders'], easier: ['strict-pullup'], harder: ['archer-pullup'], alternatives: ['strict-pullup', 'chin-up'], secPerRep: 4, family: 'pullup' },
  { id: 'archer-pullup', start: 3, pattern: 'pull', unit: 'reps', levelRange: [4, 4], equipment: BAR, muscles: ['back', 'biceps', 'forearms'], easier: ['wide-pullup'], harder: [], alternatives: ['wide-pullup', 'weighted-pullup'], secPerRep: 5, perSide: true, family: 'pullup' },
  { id: 'weighted-pullup', start: 3, pattern: 'pull', unit: 'reps', levelRange: [4, 4], equipment: BAR, muscles: ['back', 'biceps', 'forearms'], easier: ['strict-pullup'], harder: [], alternatives: ['archer-pullup', 'strict-pullup'], secPerRep: 4.5, family: 'pullup' },
  { id: 'high-pullup', start: 3, pattern: 'skill', unit: 'reps', levelRange: [3, 4], equipment: BAR, muscles: ['back', 'biceps', 'shoulders'], easier: ['strict-pullup'], harder: ['negative-muscle-up'], alternatives: ['strict-pullup', 'wide-pullup'], secPerRep: 4.5, family: 'pullup' },
  { id: 'supported-hang', start: 20, pattern: 'pull', unit: 'seconds', levelRange: [0, 1], equipment: FEET_SUPPORTED, muscles: ['forearms', 'back', 'shoulders'], easier: [], harder: ['dead-hang'], alternatives: ['dead-hang', 'active-hang'], secPerRep: 1 },
  { id: 'feet-assisted-pullup', start: 5, pattern: 'pull', unit: 'reps', levelRange: [0, 2], equipment: FEET_SUPPORTED, muscles: ['back', 'biceps', 'forearms'], easier: ['australian-row'], harder: ['negative-pullup', 'strict-pullup'], alternatives: ['band-pullup', 'australian-row'], secPerRep: 4, family: 'assisted' },
  // ── push / shoulders ─────────────────────────────────────────────────
  { id: 'wall-pushup', start: 10, pattern: 'push', unit: 'reps', levelRange: [0, 1], equipment: NONE, muscles: ['chest', 'triceps', 'shoulders'], easier: [], harder: ['incline-pushup'], alternatives: ['incline-pushup'], secPerRep: 2.5 },
  { id: 'incline-pushup', start: 8, pattern: 'push', unit: 'reps', levelRange: [0, 2], equipment: NONE, muscles: ['chest', 'triceps', 'shoulders'], easier: ['wall-pushup'], harder: ['pushup'], alternatives: ['wall-pushup', 'pushup'], secPerRep: 2.5 },
  { id: 'pushup', start: 8, pattern: 'push', unit: 'reps', levelRange: [1, 4], equipment: NONE, muscles: ['chest', 'triceps', 'shoulders'], easier: ['incline-pushup'], harder: ['diamond-pushup', 'pike-pushup'], alternatives: ['incline-pushup', 'diamond-pushup'], secPerRep: 2.5 },
  { id: 'diamond-pushup', start: 6, pattern: 'push', unit: 'reps', levelRange: [2, 4], equipment: NONE, muscles: ['triceps', 'chest'], easier: ['pushup'], harder: [], alternatives: ['pushup', 'parallel-dips', 'bench-dips'], secPerRep: 3 },
  { id: 'pike-pushup', start: 6, pattern: 'push', unit: 'reps', levelRange: [2, 4], equipment: NONE, muscles: ['shoulders', 'triceps'], easier: ['pushup'], harder: ['handstand-wall-hold'], alternatives: ['pushup', 'handstand-wall-hold'], secPerRep: 3 },
  { id: 'parallel-dips', start: 5, pattern: 'push', unit: 'reps', levelRange: [2, 4], equipment: [['dipBars']], muscles: ['chest', 'triceps', 'shoulders'], easier: ['dip-support-hold'], harder: ['straight-bar-dip'], alternatives: ['diamond-pushup', 'pushup', 'bench-dips'], secPerRep: 3 },
  { id: 'bench-dips', start: 8, pattern: 'push', unit: 'reps', levelRange: [1, 4], equipment: NONE, muscles: ['triceps', 'shoulders'], easier: [], harder: ['parallel-dips'], alternatives: ['diamond-pushup', 'pushup'], secPerRep: 2.5, optional: true },
  { id: 'dip-support-hold', start: 15, pattern: 'push', unit: 'seconds', levelRange: [1, 3], equipment: [['dipBars']], muscles: ['triceps', 'shoulders', 'chest'], easier: [], harder: ['parallel-dips'], alternatives: ['pushup', 'plank'], secPerRep: 1 },
  { id: 'handstand-wall-hold', start: 20, pattern: 'push', unit: 'seconds', levelRange: [3, 4], equipment: NONE, muscles: ['shoulders', 'core'], easier: ['pike-pushup'], harder: [], alternatives: ['pike-pushup'], secPerRep: 1 },
  // ── legs ─────────────────────────────────────────────────────────────
  { id: 'squat', start: 12, pattern: 'legs', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['quads', 'glutes'], easier: [], harder: ['reverse-lunge', 'bulgarian-split-squat'], alternatives: ['reverse-lunge', 'wall-sit'], secPerRep: 3 },
  { id: 'reverse-lunge', start: 8, pattern: 'legs', unit: 'reps', levelRange: [1, 4], equipment: NONE, muscles: ['quads', 'glutes', 'hamstrings'], easier: ['squat'], harder: ['bulgarian-split-squat'], alternatives: ['squat', 'bulgarian-split-squat'], secPerRep: 3, perSide: true },
  { id: 'bulgarian-split-squat', start: 8, pattern: 'legs', unit: 'reps', levelRange: [2, 4], equipment: NONE, muscles: ['quads', 'glutes'], easier: ['reverse-lunge'], harder: [], alternatives: ['reverse-lunge', 'squat'], secPerRep: 3.5, perSide: true },
  { id: 'glute-bridge', start: 12, pattern: 'legs', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['glutes', 'hamstrings'], easier: [], harder: [], alternatives: ['squat'], secPerRep: 3 },
  { id: 'calf-raise', start: 15, pattern: 'legs', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['calves'], easier: [], harder: [], alternatives: ['wall-sit'], secPerRep: 2 },
  { id: 'wall-sit', start: 30, pattern: 'legs', unit: 'seconds', levelRange: [0, 4], equipment: NONE, muscles: ['quads'], easier: [], harder: [], alternatives: ['squat'], secPerRep: 1 },
  // ── core ─────────────────────────────────────────────────────────────
  { id: 'dead-bug', start: 8, pattern: 'core', unit: 'reps', levelRange: [0, 2], equipment: NONE, muscles: ['core'], easier: [], harder: ['hollow-hold'], alternatives: ['plank', 'lying-leg-raise'], secPerRep: 3 },
  { id: 'hollow-hold', start: 20, pattern: 'core', unit: 'seconds', levelRange: [1, 4], equipment: NONE, muscles: ['core'], easier: ['dead-bug'], harder: [], alternatives: ['plank', 'dead-bug'], secPerRep: 1 },
  { id: 'plank', start: 30, pattern: 'core', unit: 'seconds', levelRange: [0, 4], equipment: NONE, muscles: ['core', 'shoulders'], easier: [], harder: ['hollow-hold'], alternatives: ['side-plank', 'dead-bug'], secPerRep: 1 },
  { id: 'hanging-knee-raise', start: 8, pattern: 'core', unit: 'reps', levelRange: [1, 3], equipment: BAR_OR_RINGS, muscles: ['core', 'forearms'], easier: ['lying-leg-raise'], harder: ['hanging-leg-raise'], alternatives: ['lying-leg-raise', 'dead-bug'], secPerRep: 3 },
  { id: 'lying-leg-raise', start: 8, pattern: 'core', unit: 'reps', levelRange: [0, 2], equipment: NONE, muscles: ['core', 'hips'], easier: ['dead-bug'], harder: ['hanging-knee-raise'], alternatives: ['dead-bug', 'hollow-hold'], secPerRep: 3 },
  { id: 'hanging-leg-raise', start: 6, pattern: 'core', unit: 'reps', levelRange: [3, 4], equipment: BAR, muscles: ['core', 'forearms', 'hips'], easier: ['hanging-knee-raise'], harder: [], alternatives: ['hanging-knee-raise', 'hollow-hold'], secPerRep: 3.5 },
  { id: 'side-plank', start: 20, pattern: 'core', unit: 'seconds', levelRange: [0, 4], equipment: NONE, muscles: ['core'], easier: [], harder: [], alternatives: ['plank'], secPerRep: 1, perSide: true },
  // ── mobility / recovery ──────────────────────────────────────────────
  { id: 'shoulder-dislocates', start: 10, pattern: 'mobility', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['shoulders'], easier: ['wall-slides'], harder: [], alternatives: ['wall-slides'], secPerRep: 4, optional: true },
  { id: 'wall-slides', start: 10, pattern: 'mobility', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['shoulders', 'spine'], easier: [], harder: [], alternatives: ['thoracic-extension', 'shoulder-dislocates'], secPerRep: 4 },
  { id: 'thoracic-extension', start: 6, pattern: 'mobility', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['spine'], easier: [], harder: [], alternatives: ['cat-cow', 'wall-slides'], secPerRep: 5 },
  { id: 'hip-flexor-stretch', start: 30, pattern: 'mobility', unit: 'seconds', levelRange: [0, 4], equipment: NONE, muscles: ['hips'], easier: [], harder: [], alternatives: ['cat-cow'], secPerRep: 1, perSide: true },
  { id: 'cat-cow', start: 8, pattern: 'mobility', unit: 'reps', levelRange: [0, 4], equipment: NONE, muscles: ['spine'], easier: [], harder: [], alternatives: ['thoracic-extension'], secPerRep: 4 },
  { id: 'lat-stretch', start: 30, pattern: 'mobility', unit: 'seconds', levelRange: [0, 4], equipment: NONE, muscles: ['back', 'shoulders'], easier: [], harder: [], alternatives: ['active-hang', 'wall-slides'], secPerRep: 1, perSide: true },
  { id: 'active-hang', start: 20, pattern: 'mobility', unit: 'seconds', levelRange: [0, 4], equipment: BAR_OR_RINGS, muscles: ['back', 'shoulders', 'forearms', 'spine'], easier: [], harder: [], alternatives: ['lat-stretch'], secPerRep: 1 },
  // ── skill: muscle-up path ────────────────────────────────────────────
  { id: 'straight-bar-dip', start: 5, pattern: 'skill', unit: 'reps', levelRange: [3, 4], equipment: BAR, muscles: ['triceps', 'chest', 'shoulders'], easier: ['parallel-dips'], harder: ['negative-muscle-up'], alternatives: ['parallel-dips', 'diamond-pushup'], secPerRep: 3.5 },
  { id: 'negative-muscle-up', start: 2, pattern: 'skill', unit: 'reps', levelRange: [4, 4], equipment: BAR, muscles: ['back', 'triceps', 'shoulders', 'core'], easier: ['high-pullup', 'straight-bar-dip'], harder: ['band-muscle-up'], alternatives: ['high-pullup', 'straight-bar-dip'], secPerRep: 9, family: 'muscleup' },
  { id: 'band-muscle-up', start: 3, pattern: 'skill', unit: 'reps', levelRange: [4, 4], equipment: [['bar', 'bands']], muscles: ['back', 'triceps', 'shoulders'], easier: ['negative-muscle-up'], harder: ['muscle-up'], alternatives: ['negative-muscle-up', 'high-pullup'], secPerRep: 6, family: 'muscleup' },
  { id: 'muscle-up', start: 1, pattern: 'skill', unit: 'reps', levelRange: [4, 4], equipment: BAR_OR_RINGS, muscles: ['back', 'triceps', 'shoulders', 'core'], easier: ['band-muscle-up'], harder: [], alternatives: ['band-muscle-up', 'negative-muscle-up', 'strict-pullup'], secPerRep: 6, family: 'muscleup' },
];

export const EXERCISES: Readonly<Record<ExerciseId, ExerciseDef>> = Object.fromEntries(list.map((e) => [e.id, e])) as Record<ExerciseId, ExerciseDef>;
export const EXERCISE_LIST: readonly ExerciseDef[] = list;

export function hasEquipment(def: ExerciseDef, owned: readonly Equipment[]): boolean {
  return def.equipment.some((set) => set.every((e) => owned.includes(e)));
}
