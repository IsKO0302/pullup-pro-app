import { LANGS, type Lang } from '../domain/types';
import { DEFAULT_DB_NAME } from '../storage/db';

/** Real data lives in "pullup-pro"; e2e builds set VITE_DB_NAME to a separate database. */
export const DB_NAME: string = import.meta.env.VITE_DB_NAME || DEFAULT_DB_NAME;
/** Mirror of the chosen language for first paint (read by the inline script in index.html). */
export const LANG_KEY = `${DB_NAME}:lang`;
export const APP_VERSION: string = __APP_VERSION__;

export function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return LANGS.includes(v as Lang) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: the language still lives in IndexedDB */
  }
}

/** Language for the very first launch: the browser language if supported, else English. */
export function guessLang(): Lang {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(nav as Lang) ? (nav as Lang) : 'en';
}
