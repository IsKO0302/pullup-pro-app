import { useCallback } from 'react';
import { useI18n } from '../../app/i18n';
import { EXERCISE_TEXT, type ExerciseText } from '../../data/exercises';
import type { I18n } from '../../data/i18n/core';
import type { DayType, ExerciseId, Muscle, WorkoutFlags } from '../../domain/types';

export function useExerciseText(): (id: ExerciseId) => ExerciseText {
  const { lang } = useI18n();
  return useCallback((id: ExerciseId) => EXERCISE_TEXT[lang][id], [lang]);
}

/** "Short" without a bar is a push block — say so. */
export function typeLabel(t: I18n['t'], w: { type: DayType; flags?: Pick<WorkoutFlags, 'noPullEquipment'> }): string {
  if (w.type === 'short' && w.flags?.noPullEquipment) return t('type.shortPush');
  return t(`type.${w.type}`);
}

export function typeDescription(t: I18n['t'], w: { type: DayType; flags?: Pick<WorkoutFlags, 'noPullEquipment'> }): string {
  if (w.type === 'short' && w.flags?.noPullEquipment) return t('type.shortPush.desc');
  return t(`type.${w.type}.desc`);
}

export function muscleList(t: I18n['t'], muscles: readonly Muscle[], lang: string): string {
  const names = muscles.map((m) => t(`muscle.${m}`));
  try {
    return new Intl.ListFormat(lang, { style: 'short', type: 'unit' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/** 95 → "1:35", 40 → "0:40". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Workout length for people: "≈ 32 min", "45 s" under a minute. */
export function durationText(t: I18n['t'], sec: number): string {
  if (sec < 60) return t('common.sec', { n: Math.max(0, Math.round(sec)) });
  return t('common.min', { n: Math.round(sec / 60) });
}
