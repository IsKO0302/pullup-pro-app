import type { Lang } from '../../domain/types';
import { EXPORT_SCALE, FRAMES, boxesFor, fitText, typeSpec, type FitResult, type PosterFormat, type PosterStyle } from './layout';

export interface PosterSpec {
  text: string;
  lang: Lang;
  reflection: boolean;
  style: PosterStyle;
  format: PosterFormat;
  /** The small quiet mark. */
  mark: string;
  /** Optional real result line, e.g. "18 MARCH 2026 · 21 PULL-UPS" (already upper-cased). */
  caption: string | null;
}

const SANS = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const COLORS = {
  pureBlack: { bg: '#08090B', text: '#FFFFFF', mark: '#8A9099', caption: '#A2A7AE' },
  editorial: { bg: '#101114', text: '#EEF0F2', mark: '#C5CDD7', caption: '#A2A7AE', rule: '#C5CDD7' },
} as const;

const quoteFont = (style: PosterStyle, weight: number, size: number) => `${weight} ${size}px ${style === 'pureBlack' ? SANS : SERIF}`;
const smallFont = (size: number) => `600 ${size}px ${SANS}`;

export const posterText = (spec: Pick<PosterSpec, 'text' | 'lang' | 'style' | 'format' | 'reflection'>) => {
  const t = typeSpec(spec.style, spec.format, spec.reflection);
  return t.upper ? spec.text.toLocaleUpperCase(spec.lang === 'tr' ? 'tr-TR' : spec.lang) : spec.text;
};

/** Real text measurement with the poster font (in CSS px; independent of the canvas transform). */
export function measureWith(ctx: CanvasRenderingContext2D, style: PosterStyle, weight: number) {
  return (s: string, size: number) => {
    ctx.font = quoteFont(style, weight, size);
    return ctx.measureText(s).width;
  };
}

/** Fonts must be loaded before drawing, including the Cyrillic / Latin-ext subsets the text needs. */
export async function ensureFonts(spec: PosterSpec): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const t = typeSpec(spec.style, spec.format, spec.reflection);
  const text = posterText(spec);
  await Promise.all([
    document.fonts.load(quoteFont(spec.style, t.weight, 40), text),
    document.fonts.load(smallFont(12), `${spec.mark} ${spec.caption ?? ''}`),
  ]);
  await document.fonts.ready;
}

/** Letter-spaced small caps drawn glyph by glyph (ctx.letterSpacing is not available everywhere). */
function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
}
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center') {
  let cx = align === 'center' ? x - spacedWidth(ctx, text, spacing) / 2 : x;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

const grainCache = new Map<string, HTMLCanvasElement>();
/** Subtle, deterministic film grain (same poster → same pixels). */
function grain(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  const hit = grainCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  let a = 0x5eed1234;
  for (let i = 0; i < img.data.length; i += 4) {
    // mulberry32: fast, deterministic, no visible pattern.
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) & 0xff;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 16;
  }
  g.putImageData(img, 0, 0);
  grainCache.set(key, c);
  return c;
}

/** Draws the poster at export resolution (CSS size × 2) and returns the text fit used. */
export function drawPoster(canvas: HTMLCanvasElement, spec: PosterSpec): FitResult {
  const f = FRAMES[spec.format];
  canvas.width = f.w * EXPORT_SCALE;
  canvas.height = f.h * EXPORT_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  const type = typeSpec(spec.style, spec.format, spec.reflection);
  const text = posterText(spec);
  const { quote: box, align } = boxesFor(spec.style, spec.format, !!spec.caption);
  const fit = fitText(text, box, type, measureWith(ctx, spec.style, type.weight), spec.lang);

  // Background.
  if (spec.style === 'pureBlack') {
    ctx.fillStyle = COLORS.pureBlack.bg;
    ctx.fillRect(0, 0, f.w, f.h);
  } else {
    const g = ctx.createRadialGradient(f.w / 2, f.h * 0.42, 0, f.w / 2, f.h * 0.42, f.h * 0.75);
    g.addColorStop(0, '#16181C');
    g.addColorStop(1, COLORS.editorial.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.w, f.h);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(grain(canvas.width, canvas.height), 0, 0);
    ctx.restore();
  }

  // Quote block, vertically centred (slightly above the middle for Pure Black).
  ctx.font = quoteFont(spec.style, type.weight, fit.fontSize);
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const ruleGap = 30;
  const captionGap = spec.caption ? 30 : 0;
  const groupH = spec.style === 'editorial' ? fit.height + ruleGap + captionGap : fit.height;
  const top = spec.style === 'pureBlack'
    ? box.y + Math.max(0, (box.height - groupH) * 0.46)
    : box.y + Math.max(0, (box.height + 34 + (spec.caption ? 30 : 0) - groupH) / 2);
  const x = align === 'center' ? f.w / 2 : box.x;
  const c = spec.style === 'pureBlack' ? COLORS.pureBlack : COLORS.editorial;
  ctx.fillStyle = c.text;
  fit.lines.forEach((line, i) => ctx.fillText(line, x, top + fit.lineHeight * (i + 0.5)));

  // Small, quiet details.
  ctx.textBaseline = 'alphabetic';
  if (spec.style === 'pureBlack') {
    if (spec.caption) {
      ctx.font = smallFont(11);
      ctx.fillStyle = c.caption;
      drawSpaced(ctx, spec.caption, f.padX, f.top, 1.6, 'left');
    }
    ctx.font = smallFont(11);
    ctx.fillStyle = c.mark;
    drawSpaced(ctx, spec.mark, f.padX, f.h - f.bottom, 2.6, 'left');
  } else {
    const ruleY = top + fit.height + ruleGap;
    ctx.fillStyle = COLORS.editorial.rule;
    ctx.fillRect(f.w / 2 - 24, ruleY - 0.75, 48, 1.5);
    if (spec.caption) {
      ctx.font = smallFont(10.5);
      ctx.fillStyle = c.caption;
      drawSpaced(ctx, spec.caption, f.w / 2, ruleY + 28, 1.6, 'center');
    }
    ctx.font = smallFont(11);
    ctx.fillStyle = c.mark;
    drawSpaced(ctx, spec.mark, f.w / 2, f.h - f.bottom, 2.6, 'center');
  }
  return fit;
}

export function posterFileName(id: string, style: PosterStyle, format: PosterFormat): string {
  return `pullup-pro-${id}-${style === 'pureBlack' ? 'black' : 'editorial'}-${format.replace(':', 'x')}.png`;
}

export function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
  });
}
