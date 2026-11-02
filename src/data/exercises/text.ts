import type { ExerciseId } from '../../domain/types';

export interface ExerciseText {
  name: string;
  cues: readonly [string, string, string];
  mistake: string;
  /** Extra safety note (optional exercises and demanding skills). */
  safety?: string;
}

export type ExerciseTexts = Readonly<Record<ExerciseId, ExerciseText>>;

export function x(name: string, cues: readonly [string, string, string], mistake: string, safety?: string): ExerciseText {
  return safety ? { name, cues, mistake, safety } : { name, cues, mistake };
}
