import { THOUGHTS } from '../../data/thoughts';
import { LANGS } from '../../domain/types';
import { ensureFonts, measureWith, posterText } from './draw';
import { POSTER_FORMATS, POSTER_STYLES, boxesFor, fitText, typeSpec } from './layout';

/**
 * Dev/e2e only: lays out EVERY thought in every language, style and format (with and without the
 * result line) using the real loaded fonts, and returns the ones that would not fit comfortably.
 */
export async function sweepPosters(): Promise<string[]> {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const bad: string[] = [];
  for (const lang of LANGS) {
    for (const style of POSTER_STYLES) {
      for (const format of POSTER_FORMATS) {
        for (const th of THOUGHTS) {
          const reflection = th.format === 'reflection';
          const spec = { text: th.text[lang], lang, reflection, style, format, mark: 'PULLUP PRO', caption: '1 JANUARY 2026 · 22 PULL-UPS' };
          await ensureFonts(spec);
          const type = typeSpec(style, format, reflection);
          for (const withCaption of [false, true]) {
            const box = boxesFor(style, format, withCaption).quote;
            const fit = fitText(posterText(spec), box, type, measureWith(ctx, style, type.weight), lang);
            if (fit.overflow || fit.fontSize < type.min || fit.width > box.width || fit.height > box.height || fit.lines.length > type.maxLines) {
              bad.push(`${th.id}/${lang}/${style}/${format}${withCaption ? '+caption' : ''}: ${fit.fontSize}px × ${fit.lines.length}`);
            }
          }
        }
      }
    }
  }
  return bad;
}
