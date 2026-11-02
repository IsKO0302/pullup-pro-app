import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { THOUGHTS, THOUGHTS_BY_ID } from '../src/data/thoughts';
import { typeSpec } from '../src/features/poster/layout';
import type { Lang } from '../src/domain/types';
import { dict, onboard, runToCompletion } from './helpers';

const d = dict.en;
const longest = (lang: Lang, format: 'short' | 'reflection') =>
  [...THOUGHTS].filter((t) => t.format === format).sort((a, b) => b.text[lang].length - a.text[lang].length)[0]!;

/** PNG signature + IHDR width/height. */
function pngSize(path: string) {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

const noWebShare = (page: Page) => page.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
  Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
});

async function choose(page: Page, lang: Lang, style: 'pureBlack' | 'editorial', format: '9:16' | '4:5') {
  const L = dict[lang];
  await page.getByRole('radio', { name: L[`poster.${style}`] }).click();
  await page.getByRole('radio', { name: L[format === '9:16' ? 'poster.formatStory' : 'poster.formatPost'] }).click();
  const canvas = page.locator(`canvas[data-ready="true"][data-style="${style}"][data-format="${format}"]`);
  await expect(canvas).toBeVisible();
  return canvas;
}

for (const lang of ['en', 'ru', 'tr'] as const) {
  test(`${lang.toUpperCase()}: the longest thoughts fit both styles and formats; Save exports a real 2x PNG`, async ({ page }) => {
    await noWebShare(page);
    await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
    await onboard(page, lang);
    for (const thought of [longest(lang, 'reflection'), longest(lang, 'short')]) {
      await page.goto(`/#/poster/${thought.id}`);
      for (const style of ['pureBlack', 'editorial'] as const) {
        for (const format of ['9:16', '4:5'] as const) {
          const canvas = await choose(page, lang, style, format);
          await expect(canvas).toHaveAttribute('data-overflow', 'false');
          const size = Number(await canvas.getAttribute('data-font-size'));
          expect(size).toBeGreaterThanOrEqual(typeSpec(style, format, thought.format === 'reflection').min);
          expect(Number(await canvas.getAttribute('data-width'))).toBeLessThanOrEqual(540 - 2 * 48);
          expect(await canvas.evaluate((el: HTMLCanvasElement) => [el.width, el.height])).toEqual([1080, format === '9:16' ? 1920 : 1350]);
        }
      }
    }
    // Real export: the file the user gets.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: dict[lang]['poster.download'] }).click()]);
    expect(download.suggestedFilename()).toMatch(/^pullup-pro-[a-zA-Z]+-\d-editorial-4x5\.png$/);
    const file = test.info().outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const png = pngSize(file);
    expect([png.w, png.h]).toEqual([1080, 1350]);
    expect(png.bytes).toBeGreaterThan(20_000);
    await expect(page.getByRole('status').filter({ hasText: dict[lang]['poster.ready'] })).toBeVisible();
  });
}

test('every thought fits every poster variant with the real fonts (90 × EN/RU/TR × 2 styles × 2 formats ± result line)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  const misfits = await page.evaluate(() => (window as unknown as { __pullupTest: { posterSweep: () => Promise<string[]> } }).__pullupTest.posterSweep());
  expect(misfits).toEqual([]);
});

test('Web Share with files when the device supports it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { shared: { name: string; type: string; size: number }[] };
    w.shared = [];
    Object.defineProperty(Navigator.prototype, 'canShare', { value: (data: ShareData) => !!data.files?.length, configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', {
      value: async (data: ShareData) => { for (const f of data.files ?? []) w.shared.push({ name: f.name, type: f.type, size: f.size }); },
      configurable: true,
    });
  });
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  await page.goto('/#/poster/innerStrength-1');
  await choose(page, 'en', 'pureBlack', '9:16');
  await page.getByRole('button', { name: d['poster.share'] }).click();
  await expect(page.getByRole('status').filter({ hasText: d['poster.shared'] })).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { shared: { name: string; type: string; size: number }[] }).shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatchObject({ name: 'pullup-pro-innerStrength-1-black-9x16.png', type: 'image/png' });
  expect(shared[0]!.size).toBeGreaterThan(10_000);
});

test('thought detail → Make poster → Back; completion → Share poster with the real result line', async ({ page }) => {
  await noWebShare(page);
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en', { max: 5 });

  await page.goto('/#/thoughts/hope-2');
  await page.getByRole('button', { name: d['thoughts.makePoster'] }).click();
  await expect(page.getByRole('img', { name: `${d['poster.preview']}: ${THOUGHTS_BY_ID.get('hope-2')!.text.en}` })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0); // no workout → no result line option
  await page.getByRole('button', { name: d['common.back'] }).click();
  await expect(page.locator('blockquote')).toHaveText(THOUGHTS_BY_ID.get('hope-2')!.text.en);

  await page.goto('/#/today');
  await page.getByTestId('start').click();
  await runToCompletion(page);
  const pullups = (await page.locator('.stat-grid__item').filter({ hasText: d['done.pullups'] }).locator('dd').innerText()).split('\n')[0]!.trim();
  const thoughtId = (await page.locator('.done__thought').getAttribute('data-thought-id'))!;
  await page.getByRole('textbox').fill('Felt strong');
  await page.getByRole('button', { name: d['done.share'] }).click();

  const canvas = page.locator('canvas[data-ready="true"]');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('img', { name: `${d['poster.preview']}: ${THOUGHTS_BY_ID.get(thoughtId)!.text.en}` })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-caption', `12 JANUARY 2026 · ${pullups} PULL-UPS`);
  await page.getByRole('switch', { name: d['poster.withResult'] }).click();
  await expect(page.locator('canvas[data-ready="true"]')).toHaveAttribute('data-caption', '');

  await page.getByRole('button', { name: d['common.back'] }).click();
  await expect(page.getByRole('heading', { name: d['done.title'] })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('Felt strong'); // the note was saved before leaving
});
