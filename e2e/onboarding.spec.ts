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

test('rhythm: active days include recovery days; a recovery slot is a recovery session without a short version', async ({ page }) => {
  const d = dict.en;
  // Saturday 17 January 2026: with 5 active days Saturday is the recovery slot.
  await page.clock.install({ time: new Date('2026-01-17T10:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: d['common.continue'] }).click();
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.equipment.title'] })).toBeVisible();
  await page.getByRole('button', { name: d['common.next'] }).click();
  await expect(page.getByRole('heading', { name: d['setup.rhythm.title'] })).toBeVisible();

  const split = page.getByTestId('rhythm-split');
  await expect(split).toHaveText('4 training sessions');
  await page.getByRole('radio', { name: '7', exact: true }).click();
  await expect(split).toHaveText('5 training sessions + 2 recovery days');
  await page.getByRole('radio', { name: '5', exact: true }).click();
  await expect(split).toHaveText('4 training sessions + 1 recovery day');
  await page.getByRole('button', { name: d['setup.finish'] }).click();

  await expect(page.getByRole('heading', { name: d['type.recovery'].toUpperCase() })).toBeVisible();
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByRole('button', { name: d['today.short'] })).toHaveCount(0);
  await expect(page.getByRole('button', { name: d['today.restInstead'] })).toBeVisible();
  await expect(page.locator('.week__day.is-today')).toHaveAttribute('data-state', 'today');
});

test('a beginner with only a bar gets no negatives: rows, scapular pulls and hangs instead', async ({ page }) => {
  const d = dict.en;
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en', { max: 0 });
  await expect(page.getByRole('heading', { name: d['type.pullStrength'].toUpperCase() })).toBeVisible();
  const card = page.locator('.today__card');
  await expect(card).toContainText('Australian row');
  await expect(card).toContainText('Scapular pull-up');
  await expect(card).not.toContainText(/negative/i);
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
