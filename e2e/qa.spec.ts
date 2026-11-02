/**
 * Phase 9 QA sweep: every main screen and sheet at 360 / 390 / 430 / 768 / 1280 px,
 * at 130 % text size, and in RU / TR — no sideways scrolling, no cut-off text,
 * touch targets ≥ 48 px, an axe-core audit, and no English words on RU/TR screens.
 * Runs once (mobile project); widths are set per test.
 */
import { expect, test, type Page } from '@playwright/test';
import { LANGUAGE_NAMES } from '../src/data/i18n';
import type { Lang } from '../src/domain/types';
import { dict, runToCompletion, seedDemo } from './helpers';
import { axeProblems, layoutProblems, mixedLanguage } from './qa';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'one run is enough: widths are set per test');
});

const HEIGHTS: Record<number, number> = { 360: 740, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const MONDAY = new Date('2026-01-12T10:00:00');
const THURSDAY = new Date('2026-03-19T09:30:00');

interface Sweep { width: number; lang: Lang; axe?: boolean; text130?: boolean; language?: boolean }

class Audit {
  readonly problems: string[] = [];
  readonly visited: string[] = [];
  constructor(private readonly page: Page, private readonly o: Sweep) {}

  async check(label: string) {
    await this.page.evaluate(async () => { await document.fonts.ready; });
    await this.page.waitForTimeout(60); // one layout pass after the last state change
    if (this.o.text130) {
      // The simulated 130 % text size really is applied on this screen.
      expect(await this.page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');
    }
    const found = await layoutProblems(this.page, true);
    if (this.o.axe) found.push(...await axeProblems(this.page));
    // "Isa" is the demo profile's name — user data, not UI text.
    if (this.o.language) found.push(...await mixedLanguage(this.page, this.o.lang, ['isa']));
    this.visited.push(label);
    this.problems.push(...found.map((p) => `[${label}] ${p}`));
  }
}

async function prepare(page: Page, o: Sweep) {
  await page.setViewportSize({ width: o.width, height: HEIGHTS[o.width] ?? 844 });
  // Stable layout for measuring (animations are verified separately in a11y.spec.ts).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (o.text130) {
    // Same effect as a 130 % browser text size: every size is in rem.
    await page.addInitScript(() => {
      const style = () => { const s = document.createElement('style'); s.textContent = 'html { font-size: 130% !important; }'; document.head.append(s); };
      if (document.head) style(); else document.addEventListener('DOMContentLoaded', style);
    });
  }
}

const nav = (page: Page, lang: Lang, key: 'nav.today' | 'nav.progress' | 'nav.thoughts' | 'nav.you') =>
  page.getByRole('navigation', { name: dict[lang]['nav.label'] }).getByRole('link', { name: dict[lang][key] }).click();

/** A new person: language → welcome → setup → TODAY → a full workout → poster → every tab. */
async function freshUser(page: Page, audit: Audit, lang: Lang) {
  const d = dict[lang];
  await page.clock.install({ time: MONDAY });
  await page.goto('/');
  await expect(page.getByRole('button', { name: LANGUAGE_NAMES[lang] })).toBeVisible();
  await audit.check('language');
  await page.getByRole('button', { name: LANGUAGE_NAMES[lang] }).click();
  await expect(page.getByRole('button', { name: d['common.continue'] })).toBeVisible();
  await audit.check('welcome');
  await page.getByRole('button', { name: d['common.continue'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.max.title'] })).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: d['workout.more'] }).click();
  await audit.check('setup: max');
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.equipment.title'] })).toBeVisible();
  await audit.check('setup: equipment');
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.rhythm.title'] })).toBeVisible();
  await page.getByRole('textbox').fill(lang === 'ru' ? 'Иса' : 'Isa');
  await audit.check('setup: rhythm');
  await page.getByRole('button', { name: d['setup.finish'] }).click();

  await expect(page.getByTestId('start')).toBeVisible();
  await audit.check('today');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('set-done')).toBeVisible();
  await audit.check('workout: set');
  await page.getByRole('button', { name: d['workout.howTo'] }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit.check('workout: how-to sheet');
  await page.keyboard.press('Escape');
  await page.getByTestId('set-done').click();
  await expect(page.getByRole('button', { name: d['workout.restSkip'] })).toBeVisible();
  await audit.check('workout: rest');
  await page.getByRole('button', { name: d['workout.exit'] }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit.check('workout: leave sheet');
  await page.keyboard.press('Escape');
  await runToCompletion(page, lang);
  await page.getByRole('textbox').fill(lang === 'tr' ? 'İyi bir başlangıç.' : lang === 'ru' ? 'Хорошее начало.' : 'A good start.');
  await audit.check('completion');
  await page.getByRole('button', { name: d['done.share'] }).click();
  await expect(page.getByRole('img', { name: new RegExp(`^${d['poster.preview']}`) })).toBeVisible();
  await audit.check('poster');
  await page.getByRole('button', { name: d['common.back'] }).click();
  await page.getByRole('button', { name: d['done.finish'], exact: true }).click();
  await expect(page.getByText(d['today.doneTitle'])).toBeVisible();
  await audit.check('today: done');

  await nav(page, lang, 'nav.progress');
  await expect(page.getByRole('heading', { name: d['progress.title'], level: 1 })).toBeVisible();
  await audit.check('progress: first workout');
  await page.locator('.journal__row').first().click();
  await expect(page.getByRole('button', { name: d['history.delete'] })).toBeVisible();
  await audit.check('progress: workout detail');

  await nav(page, lang, 'nav.thoughts');
  await expect(page.locator('.thought-item').first()).toBeVisible();
  await audit.check('thoughts');
  await page.locator('.thought-item').nth(4).click();
  await expect(page.getByRole('button', { name: d['thoughts.makePoster'] })).toBeVisible();
  await audit.check('thoughts: detail');

  await nav(page, lang, 'nav.you');
  await expect(page.getByRole('heading', { name: d['you.title'], level: 1 })).toBeVisible();
  await audit.check('you');
  await page.getByRole('button', { name: d['you.reset'] }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit.check('you: reset sheet');
  await page.keyboard.press('Escape');
}

/** Months of history: TODAY with the week strip, PROGRESS with charts, YOU with an import preview. */
async function longHistory(page: Page, audit: Audit, lang: Lang) {
  const d = dict[lang];
  await page.clock.install({ time: THURSDAY });
  await seedDemo(page, { today: '2026-03-19', lang, weeks: 12 });
  await page.goto('/#/today');
  await expect(page.getByTestId('start')).toBeVisible();
  await audit.check('history: today');
  await nav(page, lang, 'nav.progress');
  await expect(page.getByRole('img', { name: d['progress.chart'] }).or(page.locator('.chart')).first()).toBeVisible();
  await audit.check('history: progress');
  await page.locator('.journal__row').first().click();
  await expect(page.getByRole('button', { name: d['history.delete'] })).toBeVisible();
  await audit.check('history: workout detail');
  await nav(page, lang, 'nav.you');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: d['you.export'] }).click();
  const file = await (await download).path();
  await page.getByTestId('import-input').setInputFiles(file);
  await expect(page.getByTestId('import-preview')).toBeVisible();
  await audit.check('history: import preview');
  await page.keyboard.press('Escape');
}

async function sweep(page: Page, o: Sweep) {
  await prepare(page, o);
  const audit = new Audit(page, o);
  await freshUser(page, audit, o.lang);
  await longHistory(page, audit, o.lang);
  expect(audit.visited.length).toBeGreaterThanOrEqual(20);
  expect(audit.problems).toEqual([]);
}

for (const width of [360, 390, 430, 768, 1280]) {
  test(`${width} px: no sideways scrolling, nothing cut off, targets ≥ 48 px${width === 390 ? ', axe clean' : ''}`, async ({ page }) => {
    await sweep(page, { width, lang: 'en', axe: width === 390 });
  });
}

for (const width of [360, 390]) {
  test(`${width} px at 130 % text: layouts hold`, async ({ page }) => {
    await sweep(page, { width, lang: 'ru', text130: true });
  });
}

for (const lang of ['ru', 'tr'] as const) {
  test.describe(`${lang} browser`, () => {
    // Before a language is chosen the app follows the browser language (a Russian phone → Russian).
    test.use({ locale: lang === 'ru' ? 'ru-RU' : 'tr-TR' });
    test(`${lang.toUpperCase()}: no English left on any screen, axe clean`, async ({ page }) => {
      await sweep(page, { width: 390, lang, language: true, axe: true });
    });
  });
}
