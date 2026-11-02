import { expect, test } from '@playwright/test';
import { dict, onboard, runToCompletion, seedDemo } from './helpers';

const d = dict.en;
const MONDAY = new Date('2026-01-12T10:00:00');
const WEDNESDAY_LATER = new Date('2026-03-18T10:00:00');

const openProgress = async (page: import('@playwright/test').Page, lang: keyof typeof dict = 'en') => {
  await page.getByRole('link', { name: dict[lang]['nav.progress'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: dict[lang]['progress.title'] })).toBeVisible();
};

test('new user: a written empty state, the path from the setup answer, milestones show their criteria', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 3 });
  await openProgress(page);
  await expect(page.getByText(d['progress.emptyTitle'])).toBeVisible();
  await expect(page.getByText(d['progress.chart'])).toHaveCount(0);
  await expect(page.getByText('Current stage: Strict')).toBeVisible();
  await expect(page.getByText(d['path.disclaimer'])).toBeVisible();
  await expect(page.locator('.milestone.is-locked')).toHaveCount(12);
  await expect(page.getByText(d['milestone.firstWorkout.how'])).toBeVisible();
  await expect(page.getByText(d['progress.historyEmptyTitle'])).toBeVisible();
  await page.getByRole('button', { name: d['progress.goToday'] }).click();
  await expect(page.getByTestId('start')).toBeVisible();
});

test('the first workout appears in PROGRESS: totals, journal note, first milestone — one point is not a line', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 5 });
  await page.getByTestId('start').click();
  await runToCompletion(page);
  await page.getByRole('textbox').fill('First one in the book');
  await page.getByRole('button', { name: d['done.finish'], exact: true }).click();
  await openProgress(page);

  const workouts = page.locator('.stat-grid__item').filter({ hasText: d['progress.workouts'] });
  await expect(workouts.locator('dd')).toHaveText('1');
  await expect(page.getByText(d['progress.chartEmpty'])).toBeVisible();
  await expect(page.locator('.milestone.is-reached').filter({ hasText: d['milestone.firstWorkout'] })).toBeVisible();
  await expect(page.locator('.milestone.is-reached').filter({ hasText: d['milestone.firstStrict'] })).toBeVisible();

  await page.locator('.journal__row').filter({ hasText: 'First one in the book' }).click();
  await expect(page.getByRole('heading', { level: 1, name: d['type.pullStrength'] })).toBeVisible();
  await expect(page.getByText('First one in the book')).toBeVisible();
  await expect(page.getByText('Strict pull-up', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: d['common.back'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: d['progress.title'] })).toBeVisible();
});

test('months of history: the chart is keyboard-navigable and opens the workout; delete needs one confirmation', async ({ page }) => {
  await page.clock.install({ time: WEDNESDAY_LATER });
  await seedDemo(page, { today: '2026-03-18', lang: 'en', weeks: 10 });
  await page.goto('/#/progress');
  await expect(page.getByRole('heading', { level: 1, name: d['progress.title'] })).toBeVisible();

  const slider = page.getByRole('slider', { name: d['progress.chart'] });
  const n = Number(await slider.getAttribute('aria-valuemax'));
  expect(n).toBeGreaterThan(2);
  await expect(slider).toHaveAttribute('aria-valuenow', String(n));
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Week of 5 Jan: \d+/);
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '2');
  await page.getByRole('button', { name: d['progress.openWorkout'] }).click();
  await expect(page.getByRole('button', { name: d['history.delete'] })).toBeVisible();
  await page.getByRole('button', { name: d['common.back'] }).click();

  // Weekly rhythm: 12 labelled weeks, the current one marked.
  await expect(page.locator('.rhythm__week')).toHaveCount(12);
  await expect(page.locator('.rhythm__week.is-current')).toHaveAttribute('aria-label', /this week/);
  await expect(page.getByText(/^Weeks on plan: \d+ of \d+$/)).toBeVisible();

  // Journal: 20 at a time.
  await expect(page.locator('.journal__row')).toHaveCount(20);
  await page.getByRole('button', { name: d['progress.showMore'] }).last().click();
  expect(await page.locator('.journal__row').count()).toBeGreaterThan(20);

  const total = page.locator('.stat-grid__item').filter({ hasText: d['progress.workouts'] }).locator('dd');
  const before = Number(await total.textContent());
  const first = page.locator('.journal__row').first();
  const label = await first.locator('.journal__date').textContent();
  await first.click();
  await page.getByRole('button', { name: d['history.delete'] }).click();
  await expect(page.getByText(d['history.deleteText'])).toBeVisible();
  await page.getByRole('button', { name: d['common.delete'], exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: d['progress.title'] })).toBeVisible();
  await expect(total).toHaveText(String(before - 1));
  await expect(page.locator('.journal__date').first()).not.toHaveText(label ?? '');
});

for (const lang of ['ru', 'tr'] as const) {
  test(`PROGRESS reads naturally in ${lang} (no missing keys, locale dates)`, async ({ page }) => {
    await page.clock.install({ time: WEDNESDAY_LATER });
    await seedDemo(page, { today: '2026-03-18', lang, weeks: 6 });
    await page.goto('/#/progress');
    const t = dict[lang];
    await expect(page.getByRole('heading', { level: 1, name: t['progress.title'] })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    for (const key of ['progress.rhythm', 'progress.path', 'progress.milestones', 'progress.history'] as const) {
      await expect(page.getByRole('heading', { name: t[key], exact: true })).toBeVisible();
    }
    await expect(page.getByText(/\{|\}|undefined|NaN/)).toHaveCount(0);
  });
}
