import { expect, test } from '@playwright/test';
import { LANGS } from '../src/domain/types';
import { dict, onboard } from './helpers';

for (const lang of LANGS) {
  test(`first launch in ${lang}: language → welcome → setup → TODAY in under 60 s`, async ({ page }) => {
    const started = Date.now();
    await onboard(page, lang, { name: 'Isa' });
    expect(Date.now() - started).toBeLessThan(60_000);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByText(dict[lang]['nav.today'], { exact: true })).toBeVisible();
    // The choice is persisted: after a reload we land on TODAY again, no welcome.
    await page.reload();
    await expect(page.getByRole('navigation', { name: dict[lang]['nav.label'] })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByText(dict[lang]['welcome.label'])).toHaveCount(0);
  });
}

test('onboarding resumes on the same step after a reload; skip keeps defaults', async ({ page }) => {
  const d = dict.en;
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: d['common.continue'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.max.title'] })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: d['setup.max.title'] })).toBeVisible();
  await page.getByRole('button', { name: d['common.skip'] }).click();
  await page.getByRole('button', { name: d['common.skip'] }).click();
  await expect(page.getByRole('radio', { name: '4', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: d['common.skip'] }).click();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
});

test('language switches instantly in YOU without a reload', async ({ page }) => {
  await onboard(page, 'en');
  await page.getByRole('link', { name: dict.en['nav.you'] }).click();
  await page.getByRole('radio', { name: 'Türkçe' }).click();
  await expect(page.getByRole('link', { name: dict.tr['nav.you'] })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.getByRole('radio', { name: 'Русский' }).click();
  await expect(page.getByRole('link', { name: dict.ru['nav.today'] })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: dict.ru['nav.today'] })).toBeVisible();
});
