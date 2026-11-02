import { utcMidnight, type LocalDate } from '../../domain/time';
import type { Lang } from '../../domain/types';
import { DICTIONARIES, type MessageKey, type PluralBase } from './index';

export type Vars = Readonly<Record<string, string | number>>;
export type PluralForm = 'one' | 'few' | 'many' | 'other';

/** BCP-47 locales used for Intl formatting (weeks start on Monday, DECISIONS D5). */
export const LOCALES: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', tr: 'tr-TR' };

export interface I18n {
  readonly lang: Lang;
  readonly locale: string;
  /** Translate a key; `{name}` placeholders are replaced, numbers are locale-formatted. */
  t: (key: MessageKey, vars?: Vars) => string;
  /** Plural-aware message: picks `.one/.few/.many/.other` with Intl.PluralRules; `{n}` is the count. */
  tp: (base: PluralBase, n: number, vars?: Vars) => string;
  num: (n: number) => string;
  /** Formats a local calendar date (no time-zone shift: formatted at UTC midnight). */
  date: (d: LocalDate, opts?: Intl.DateTimeFormatOptions) => string;
  /** Locale-aware upper case (Turkish dotted/dotless i). */
  upper: (s: string) => string;
  pluralForm: (n: number) => PluralForm;
}

export function interpolate(template: string, vars: Vars | undefined, num: (n: number) => string): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name];
    if (v === undefined) return match;
    return typeof v === 'number' ? num(v) : v;
  });
}

/** Placeholder names used in a template, e.g. "Set {i} of {n}" → ["i", "n"]. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();
}

const cache = new Map<Lang, I18n>();

export function createI18n(lang: Lang): I18n {
  const hit = cache.get(lang);
  if (hit) return hit;
  const dict = DICTIONARIES[lang];
  const locale = LOCALES[lang];
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pr = new Intl.PluralRules(locale);
  const dateFormats = new Map<string, Intl.DateTimeFormat>();
  const num = (n: number) => nf.format(n);
  const pluralForm = (n: number): PluralForm => {
    const c = pr.select(n);
    return c === 'one' || c === 'few' || c === 'many' ? c : 'other';
  };
  const i18n: I18n = {
    lang,
    locale,
    t: (key, vars) => interpolate(dict[key], vars, num),
    tp: (base, n, vars) => interpolate(dict[`${base}.${pluralForm(n)}` as MessageKey], { n, ...vars }, num),
    num,
    date: (d, opts = { day: 'numeric', month: 'long' }) => {
      const k = JSON.stringify(opts);
      let f = dateFormats.get(k);
      if (!f) {
        f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
        dateFormats.set(k, f);
      }
      return f.format(new Date(utcMidnight(d)));
    },
    upper: (s) => s.toLocaleUpperCase(locale),
    pluralForm,
  };
  cache.set(lang, i18n);
  return i18n;
}
