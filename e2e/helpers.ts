import { expect, type Page } from '@playwright/test';
import { DICTIONARIES, LANGUAGE_NAMES } from '../src/data/i18n';
import type { Lang } from '../src/domain/types';

export const dict = DICTIONARIES;

export interface OnboardOptions {
  max?: number;
  days?: number;
  name?: string;
}

/** Fresh first launch through language → welcome → 3 setup screens → TODAY. */
export async function onboard(page: Page, lang: Lang = 'en', opts: OnboardOptions = {}) {
  const d = DICTIONARIES[lang];
  await page.goto('/');
  await page.getByRole('button', { name: LANGUAGE_NAMES[lang] }).click();
  await page.getByRole('button', { name: d['common.continue'] }).click();
  const more = page.getByRole('button', { name: d['workout.more'] });
  for (let i = 0; i < (opts.max ?? 3); i++) await more.click();
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.equipment.title'] })).toBeVisible();
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.rhythm.title'] })).toBeVisible();
  if (opts.days) await page.getByRole('radio', { name: String(opts.days), exact: true }).click();
  if (opts.name) await page.getByRole('textbox').fill(opts.name);
  await page.getByRole('button', { name: d['setup.finish'] }).click();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
}

/** Logs every remaining set with its default target, skipping rest and timing holds briefly. */
export async function runToCompletion(page: Page, lang: Lang = 'en') {
  const d = DICTIONARIES[lang];
  const title = page.getByRole('heading', { name: d['done.title'] });
  for (let guard = 0; guard < 120; guard++) {
    if (await title.isVisible()) return;
    const skipRest = page.getByRole('button', { name: d['workout.restSkip'] });
    if (await skipRest.isVisible()) {
      await skipRest.click();
      continue;
    }
    const startTimer = page.getByRole('button', { name: d['workout.timerStart'] });
    if (await startTimer.isVisible()) {
      await startTimer.click();
      await page.clock.runFor(3000);
      await page.getByRole('button', { name: d['workout.timerStop'] }).click();
    }
    const setDone = page.getByTestId('set-done');
    if (await setDone.isVisible()) await setDone.click();
    else await page.waitForTimeout(50);
  }
  await expect(title).toBeVisible();
}

export interface DemoSeed {
  today: string;
  lang?: Lang;
  weeks?: number;
  max?: number;
}

/**
 * Replaces the E2E database (never the real one — the hook refuses "pullup-pro")
 * with deterministic demo history, then reloads the store.
 */
export async function seedDemo(page: Page, seed: DemoSeed) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __pullupTest?: unknown }).__pullupTest);
  await page.evaluate((s) => (window as unknown as { __pullupTest: { seedDemo: (o: unknown) => Promise<void> } }).__pullupTest.seedDemo(s), seed);
}
