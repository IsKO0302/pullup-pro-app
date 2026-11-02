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
