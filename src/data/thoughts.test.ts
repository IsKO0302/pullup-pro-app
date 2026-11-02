import { describe, expect, it } from 'vitest';
import { LANGS, THOUGHT_CATEGORIES, type Lang } from '../domain/types';
import { THOUGHTS, THOUGHTS_BY_ID } from './thoughts';

/** Tokens that contain a letter or digit ("—" is not a word). */
export const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** Sentences end with . ! ? or … followed by a space or the end of the text. */
export const sentenceCount = (s: string) => s.split(/[.!?…]+(?=\s|$)/u).filter((x) => x.trim() !== '').length;

const SHORT_MAX_WORDS = 7;
const SHORT_MAX_CHARS = 48;
const REFLECTION_MAX_CHARS = 200;

const CLICHES: Record<Lang, RegExp[]> = {
  en: [/believe in yourself/i, /no pain/i, /never give up/i, /dream big/i, /hustle/i, /grind/i, /beast mode/i, /no excuses/i],
  ru: [/верь в себя/i, /без боли/i, /никогда не сдавайся/i, /мечтай по-крупному|мечтай масштабно/i, /никаких оправданий/i],
  tr: [/kendine inan/i, /acı yoksa/i, /asla pes etme/i, /büyük hayaller kur/i, /bahane yok/i],
};

const all = (fn: (text: string, lang: Lang, id: string) => boolean) =>
  THOUGHTS.flatMap((th) => LANGS.filter((l) => !fn(th.text[l], l, th.id)).map((l) => `${th.id}/${l}: ${th.text[l]}`));

describe('PULLUP PRO ORIGINALS library', () => {
  it('has at least 90 thoughts with unique ids', () => {
    expect(THOUGHTS.length).toBeGreaterThanOrEqual(90);
    expect(new Set(THOUGHTS.map((t) => t.id)).size).toBe(THOUGHTS.length);
    expect(THOUGHTS_BY_ID.size).toBe(THOUGHTS.length);
  });

  it('every category has 4 short thoughts and 2 reflections', () => {
    for (const c of THOUGHT_CATEGORIES) {
      const list = THOUGHTS.filter((t) => t.category === c);
      expect(list.filter((t) => t.format === 'short'), c).toHaveLength(4);
      expect(list.filter((t) => t.format === 'reflection'), c).toHaveLength(2);
    }
    expect(THOUGHTS.every((t) => THOUGHT_CATEGORIES.includes(t.category))).toBe(true);
  });

  it('every thought has all three languages, trimmed, without double spaces', () => {
    expect(all((s) => s.length > 0 && s === s.trim() && !/\s{2}/.test(s))).toEqual([]);
  });

  it('every text ends with punctuation and uses typographic quotes only', () => {
    expect(all((s) => /[.!?…]$/u.test(s))).toEqual([]);
    expect(all((s) => !/["'`]/.test(s))).toEqual([]);
  });

  it(`short thoughts are poster-ready (≤ ${SHORT_MAX_WORDS} words, ≤ ${SHORT_MAX_CHARS} characters)`, () => {
    const short = (fn: Parameters<typeof all>[0]) => all((s, l, id) => THOUGHTS_BY_ID.get(id)!.format !== 'short' || fn(s, l, id));
    expect(short((s) => wordCount(s) <= SHORT_MAX_WORDS)).toEqual([]);
    expect(short((s) => s.length <= SHORT_MAX_CHARS)).toEqual([]);
  });

  it(`reflections have 2–4 sentences and ≤ ${REFLECTION_MAX_CHARS} characters`, () => {
    const refl = (fn: Parameters<typeof all>[0]) => all((s, l, id) => THOUGHTS_BY_ID.get(id)!.format !== 'reflection' || fn(s, l, id));
    expect(refl((s) => sentenceCount(s) >= 2 && sentenceCount(s) <= 4)).toEqual([]);
    expect(refl((s) => s.length <= REFLECTION_MAX_CHARS)).toEqual([]);
  });

  it('each language is its own text (no copies across languages or within a language)', () => {
    expect(THOUGHTS.filter((t) => new Set(LANGS.map((l) => t.text[l])).size !== LANGS.length).map((t) => t.id)).toEqual([]);
    for (const l of LANGS) {
      const texts = THOUGHTS.map((t) => t.text[l].toLocaleLowerCase(l));
      expect(new Set(texts).size, l).toBe(texts.length);
    }
  });

  it('avoids clichés, attributions and unsafe wording', () => {
    expect(all((s, l) => !CLICHES[l].some((re) => re.test(s)))).toEqual([]);
    // No "— Name" signatures or "said …" attributions: these are originals.
    expect(all((s) => !/[—–-]\s*\p{Lu}\p{Ll}+(\s\p{Lu}\p{Ll}+)*\s*$/u.test(s))).toEqual([]);
    expect(all((s) => !/\b(said|once wrote)\b|сказал|писал|dedi ki/iu.test(s))).toEqual([]);
    expect(all((s) => !/вешайся|убей|kendini as/iu.test(s))).toEqual([]);
  });

  it('uses the right script per language', () => {
    expect(all((s, l) => (l === 'ru' ? /[а-яё]/i.test(s) && !/[a-z]{3,}/i.test(s) : !/[а-яё]/i.test(s)))).toEqual([]);
  });
});
