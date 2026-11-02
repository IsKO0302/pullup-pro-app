import type { Lang } from '../../domain/types';
import { en, type Dictionary, type MessageKey } from './en';
import { ru } from './ru';
import { tr } from './tr';

export type { Dictionary, MessageKey };
export const DICTIONARIES: Record<Lang, Dictionary> = { en, ru, tr };

/** Language names are shown in their own language (language-neutral picker). */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', ru: 'Русский', tr: 'Türkçe' };
export const LANGUAGE_PICKER_LABEL = 'Language · Язык · Dil';

type PluralBaseOf<K> = K extends `${infer B}.other` ? (B extends `plural.${string}` ? B : never) : never;
export type PluralBase = PluralBaseOf<MessageKey>;
