import type { Lang } from '../../domain/types';
import type { ExerciseTexts } from './text';
import { EXERCISE_TEXT_EN } from './text.en';
import { EXERCISE_TEXT_RU } from './text.ru';
import { EXERCISE_TEXT_TR } from './text.tr';

export { EXERCISES, EXERCISE_LIST, hasEquipment, type ExerciseDef } from './catalog';
export type { ExerciseText, ExerciseTexts } from './text';
export const EXERCISE_TEXT: Readonly<Record<Lang, ExerciseTexts>> = { en: EXERCISE_TEXT_EN, ru: EXERCISE_TEXT_RU, tr: EXERCISE_TEXT_TR };
