/**
 * Poster text layout — pure and unit-tested. The canvas code passes a real `measure`
 * (ctx.measureText with the loaded fonts); tests pass a deliberately wide fake one.
 */
export type PosterStyle = 'pureBlack' | 'editorial';
export type PosterFormat = '9:16' | '4:5';
export const POSTER_STYLES: readonly PosterStyle[] = ['pureBlack', 'editorial'];
export const POSTER_FORMATS: readonly PosterFormat[] = ['9:16', '4:5'];
/** Exported PNG = CSS size × 2 → 1080 × 1920 and 1080 × 1350. */
export const EXPORT_SCALE = 2;

export interface Frame {
  w: number;
  h: number;
  padX: number;
  /** Safe insets: stories cover roughly the top and bottom 12 % with app UI. */
  top: number;
  bottom: number;
}
export const FRAMES: Record<PosterFormat, Frame> = {
  '9:16': { w: 540, h: 960, padX: 48, top: 132, bottom: 116 },
  '4:5': { w: 540, h: 675, padX: 48, top: 60, bottom: 52 },
};

export interface TypeSpec {
  max: number;
  min: number;
  /** Line height as a multiple of the font size. */
  lh: number;
  weight: number;
  upper: boolean;
  maxLines: number;
}
const SHORT_LINES: Record<PosterFormat, number> = { '9:16': 6, '4:5': 5 };
const FORMAT_SCALE: Record<PosterFormat, number> = { '9:16': 1, '4:5': 0.86 };

export function typeSpec(style: PosterStyle, format: PosterFormat, reflection: boolean): TypeSpec {
  const k = FORMAT_SCALE[format];
  const base = style === 'pureBlack'
    ? (reflection ? { max: 40, min: 16, lh: 1.26, weight: 600, upper: false } : { max: 68, min: 24, lh: 1.04, weight: 700, upper: true })
    : (reflection ? { max: 44, min: 18, lh: 1.2, weight: 500, upper: false } : { max: 80, min: 26, lh: 1.04, weight: 600, upper: false });
  return { ...base, max: Math.round(base.max * k), min: Math.round(base.min * k), maxLines: reflection ? 99 : SHORT_LINES[format] };
}

export type Measure = (text: string, fontSize: number) => number;

const TR_ENCLITIC = /^(de|da|mi|mı|mu|mü)[.,!?…]*$/iu;

/**
 * Splits on spaces into unbreakable units:
 * - a lone dash stays with the previous word (a line never starts with "—");
 * - EN/RU: one- and two-letter words stay with the next word ("с собой", "a year");
 * - TR: the enclitics de/da/mi stay with the previous word ("Ben de.").
 */
export function tokenize(text: string, lang?: string): string[] {
  const out: string[] = [];
  let carry = '';
  for (const w of text.trim().split(/\s+/)) {
    if (!w) continue;
    if (/^[—–-]$/.test(w) && out.length > 0 && !carry) {
      out[out.length - 1] += ` ${w}`;
      continue;
    }
    if (lang === 'tr' && TR_ENCLITIC.test(w) && out.length > 0 && !carry) {
      out[out.length - 1] += ` ${w}`;
      continue;
    }
    const word = carry ? `${carry} ${w}` : w;
    carry = '';
    if ((lang === 'en' || lang === 'ru') && /^[\p{L}]{1,2}$/u.test(w)) {
      carry = word;
      continue;
    }
    out.push(word);
  }
  if (carry) out.push(carry);
  return out;
}

/** Greedy word wrap. Returns null when a single word is wider than the line. */
export function wrap(tokens: readonly string[], width: number, size: number, measure: Measure): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const word of tokens) {
    if (measure(word, size) > width) return null;
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Last resort for text no rule anticipated: break inside words, character by character. */
function hardWrap(text: string, width: number, size: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const next = line + ch;
    if (line && measure(next, size) > width) {
      lines.push(line.trimEnd());
      line = ch.trimStart();
    } else {
      line = next;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

export interface FitResult {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  /** Height of the text block. */
  height: number;
  /** Widest line. */
  width: number;
  /** True only if even the emergency path could not fit (never for the shipped library). */
  overflow: boolean;
}

const FLOOR = 10;

/**
 * The largest font size (max → min, then down to an emergency floor) at which every word fits
 * the width, the lines fit the height and there are at most `maxLines` lines. Lines are then
 * balanced (narrowest width that keeps the same line count) so a poster never ends on one lonely word.
 */
export function fitText(text: string, box: { width: number; height: number }, spec: Pick<TypeSpec, 'max' | 'min' | 'lh' | 'maxLines'>, measure: Measure, lang?: string): FitResult {
  const tokens = tokenize(text, lang);
  const result = (size: number, lines: string[], overflow = false): FitResult => ({
    fontSize: size,
    lineHeight: size * spec.lh,
    lines,
    height: lines.length * size * spec.lh,
    width: Math.max(0, ...lines.map((l) => measure(l, size))),
    overflow,
  });
  for (let size = spec.max; size >= FLOOR; size -= 1) {
    const lines = wrap(tokens, box.width, size, measure);
    if (!lines) continue;
    if (size >= spec.min && lines.length > spec.maxLines) continue;
    if (lines.length * size * spec.lh > box.height) continue;
    return result(size, balance(tokens, lines.length, box.width, size, measure) ?? lines);
  }
  const lines = hardWrap(text, box.width, FLOOR, measure);
  return result(FLOOR, lines, lines.length * FLOOR * spec.lh > box.height);
}

function balance(tokens: readonly string[], count: number, width: number, size: number, measure: Measure): string[] | null {
  if (count < 2) return null;
  let lo = width * 0.5;
  let hi = width;
  let best: string[] | null = null;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrap(tokens, mid, size, measure);
    if (lines && lines.length === count) {
      best = lines;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

export interface PosterBoxes {
  /** Area available to the quote. */
  quote: { x: number; y: number; width: number; height: number };
  align: 'left' | 'center';
}

/** Where the quote may go for a style/format (the mark, rule and caption have their own space). */
export function boxesFor(style: PosterStyle, format: PosterFormat, withCaption: boolean): PosterBoxes {
  const f = FRAMES[format];
  const markSpace = 44;
  if (style === 'pureBlack') {
    const y = f.top + (withCaption ? 36 : 0);
    return { quote: { x: f.padX, y, width: f.w - 2 * f.padX, height: f.h - f.bottom - markSpace - y }, align: 'left' };
  }
  // Editorial: quote + silver rule (+ caption) are centred together; reserve their height.
  const below = 34 + (withCaption ? 30 : 0);
  return { quote: { x: f.padX + 8, y: f.top, width: f.w - 2 * f.padX - 16, height: f.h - f.bottom - markSpace - below - f.top }, align: 'center' };
}
