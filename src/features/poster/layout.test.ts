import { describe, expect, it } from 'vitest';
import { THOUGHTS } from '../../data/thoughts';
import { LANGS } from '../../domain/types';
import { FRAMES, POSTER_FORMATS, POSTER_STYLES, boxesFor, fitText, tokenize, typeSpec, wrap, type Measure } from './layout';

/** Deliberately wider than the real fonts: wide letters count almost a full em. */
const WIDE = /[MWШЩЖЮЫДФмшщжюыдфQOGÇĞÖŞÜ@%]/u;
const fake = (upperFactor: number, lowerFactor: number): Measure => (text, size) =>
  [...text].reduce((w, ch) => w + size * (WIDE.test(ch) ? 0.95 : ch === ' ' ? 0.28 : ch === ch.toLocaleUpperCase() && /\p{L}/u.test(ch) ? upperFactor : lowerFactor), 0);
const sans = fake(0.7, 0.56);
const serif = fake(0.66, 0.5);

describe('tokenize / wrap', () => {
  it('keeps a lone dash with the previous word', () => {
    expect(tokenize('Медленно — тоже вперёд.')).toEqual(['Медленно —', 'тоже', 'вперёд.']);
    expect(tokenize('  a   b ')).toEqual(['a', 'b']);
  });
  it('keeps short words with their neighbour (RU/EN prepositions, TR enclitics)', () => {
    expect(tokenize('Сравнивать себя с другими — игра, в которой', 'ru')).toEqual(['Сравнивать', 'себя', 'с другими —', 'игра,', 'в которой']);
    expect(tokenize('A year from now, I keep going.', 'en')).toEqual(['A year', 'from', 'now,', 'I keep', 'going.']);
    expect(tokenize('Kötü günler de biter. Ben de.', 'tr')).toEqual(['Kötü', 'günler de', 'biter.', 'Ben de.']);
    expect(tokenize('и', 'ru')).toEqual(['и']);
  });
  it('wraps greedily and reports words that cannot fit', () => {
    const m: Measure = (t) => t.length;
    expect(wrap(['aa', 'bb', 'cc'], 5, 1, m)).toEqual(['aa bb', 'cc']);
    expect(wrap(['toolongword'], 5, 1, m)).toBeNull();
  });
});

describe('fitText', () => {
  const m: Measure = (t, s) => t.length * s * 0.5;
  it('uses the largest size that fits and balances the lines', () => {
    const r = fitText('one two three four', { width: 100, height: 400 }, { max: 40, min: 10, lh: 1, maxLines: 9 }, m);
    expect(r.overflow).toBe(false);
    expect(r.lines.every((l) => m(l, r.fontSize) <= 100)).toBe(true);
    // Balanced: no line is a single short word when two lines would do.
    expect(Math.max(...r.lines.map((l) => l.length)) - Math.min(...r.lines.map((l) => l.length))).toBeLessThanOrEqual(5);
  });
  it('shrinks for long text and respects maxLines', () => {
    const long = Array.from({ length: 30 }, () => 'word').join(' ');
    const r = fitText(long, { width: 200, height: 200 }, { max: 60, min: 12, lh: 1.2, maxLines: 99 }, m);
    expect(r.height).toBeLessThanOrEqual(200);
    expect(r.fontSize).toBeLessThan(60);
    const capped = fitText('a b c d e f g h', { width: 30, height: 999 }, { max: 60, min: 1, lh: 1, maxLines: 3 }, m);
    expect(capped.lines.length).toBeLessThanOrEqual(3);
  });
  it('breaks inside words only as a last resort, and never reports a false fit', () => {
    const r = fitText('Supercalifragilisticexpialidocious', { width: 40, height: 400 }, { max: 60, min: 30, lh: 1, maxLines: 9 }, m);
    expect(r.lines.every((l) => m(l, r.fontSize) <= 40)).toBe(true);
    expect(r.lines.join('')).toBe('Supercalifragilisticexpialidocious');
    expect(fitText('x '.repeat(400), { width: 20, height: 20 }, { max: 20, min: 10, lh: 1, maxLines: 9 }, m).overflow).toBe(true);
  });
});

describe('every thought fits every poster (EN/RU/TR × 2 styles × 2 formats)', () => {
  for (const style of POSTER_STYLES) {
    for (const format of POSTER_FORMATS) {
      for (const caption of [false, true]) {
        it(`${style} ${format}${caption ? ' + result line' : ''}`, () => {
          const box = boxesFor(style, format, caption).quote;
          expect(box.height).toBeGreaterThan(FRAMES[format].h * 0.4);
          const bad: string[] = [];
          for (const th of THOUGHTS) {
            for (const lang of LANGS) {
              const spec = typeSpec(style, format, th.format === 'reflection');
              const text = spec.upper ? th.text[lang].toLocaleUpperCase(lang) : th.text[lang];
              const measure = style === 'pureBlack' ? sans : serif;
              const r = fitText(text, box, spec, measure, lang);
              const ok = !r.overflow && r.fontSize >= spec.min && r.height <= box.height
                && r.lines.every((l) => measure(l, r.fontSize) <= box.width) && r.lines.length <= spec.maxLines
                && r.lines.join(' ') === text.split(/\s+/).join(' ');
              if (!ok) bad.push(`${th.id}/${lang}: ${r.fontSize}px ${r.lines.length} lines`);
            }
          }
          expect(bad).toEqual([]);
        });
      }
    }
  }
});
