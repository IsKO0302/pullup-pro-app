import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1];
};
const lum = (hex: string) => {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('color contrast (WCAG AA)', () => {
  const surfaces = ['bg', 'surface-1', 'surface-2', 'surface-3'];
  for (const text of ['text', 'text-2', 'text-3', 'danger-text', 'silver']) {
    for (const surface of surfaces) {
      it(`--${text} on --${surface} ≥ 4.5:1`, () => {
        expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('primary button text (--bg on --silver) ≥ 4.5:1', () => {
    expect(contrast(token('bg'), token('silver'))).toBeGreaterThanOrEqual(4.5);
  });
  it('danger solid button text (--bg on --danger) ≥ 4.5:1', () => {
    expect(contrast(token('bg'), token('danger'))).toBeGreaterThanOrEqual(4.5);
  });
});
