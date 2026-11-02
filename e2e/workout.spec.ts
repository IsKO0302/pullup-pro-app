import { expect, test, type Page } from '@playwright/test';
import { dict, onboard, runToCompletion } from './helpers';

const d = dict.en;
// 4 days a week (default): Mon pull strength, Tue push, Wed rest, Thu pull volume, Fri legs + core.
const MONDAY = new Date('2026-01-12T10:00:00');
const WEDNESDAY = new Date('2026-01-14T10:00:00');

const today = (page: Page) => page.locator('.week__day.is-today');

test('START → sets → rest survives a reload → completion is saved → TODAY shows done', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 5 });
  await expect(page.getByRole('heading', { name: d['type.pullStrength'].toUpperCase() })).toBeVisible();
  await expect(today(page)).toHaveAttribute('data-state', 'today');

  await page.getByTestId('start').click();
  await expect(page.getByText('Exercise 1 /', { exact: false })).toBeVisible();
  await expect(page.getByText('Set 1 of', { exact: false })).toBeVisible();
  // Warm-up is collapsed but available; "feeling off" is offered before the first set.
  await expect(page.getByText(d['workout.warmup'])).toBeVisible();
  await expect(page.getByRole('switch', { name: d['workout.lighter'] })).toBeVisible();

  await page.getByTestId('set-done').click();
  const skipRest = page.getByRole('button', { name: d['workout.restSkip'] });
  await expect(skipRest).toBeVisible();
  await expect(page.getByRole('img', { name: /seconds of rest left/ })).toBeVisible();

  // The session is persisted after every set: a reload lands back in the same rest.
  await page.reload();
  await expect(skipRest).toBeVisible();
  await expect(page.getByText('Exercise 1 /', { exact: false })).toBeVisible();
  // The "feeling off" switch is gone once the first set is logged.
  await expect(page.getByRole('switch', { name: d['workout.lighter'] })).toHaveCount(0);

  await skipRest.click();
  await expect(page.getByText('Set 2 of', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: d['workout.howTo'] }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await runToCompletion(page);
  await expect(page.getByText(d['done.sets'])).toBeVisible();
  await expect(page.getByText(d['done.early'])).toHaveCount(0);
  // First workout ever: no previous best, so no "records".
  await expect(page.getByText(d['done.records'])).toHaveCount(0);

  await page.getByRole('button', { name: d['mood.4'] }).click();
  await expect(page.getByRole('button', { name: d['mood.4'] })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox').fill('Felt solid today');
  await page.getByRole('button', { name: d['done.finish'], exact: true }).click();

  await expect(page.getByText(d['today.doneTitle'])).toBeVisible();
  await expect(page.getByRole('button', { name: d['today.trainMore'] })).toBeVisible();
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect(today(page)).toHaveAttribute('data-state', 'done');

  await page.reload();
  await expect(page.getByText(d['today.doneTitle'])).toBeVisible();
  await expect(page.getByText('Tomorrow: Push + Shoulders')).toBeVisible();
});

test('leaving mid-workout keeps progress; Continue resumes; finishing early saves only real sets', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 5 });
  await page.getByTestId('start').click();
  await page.getByTestId('set-done').click();
  await page.getByRole('button', { name: d['workout.restSkip'] }).click();

  await page.getByRole('button', { name: d['workout.exit'] }).click();
  await page.getByRole('button', { name: d['workout.exitSave'] }).click();
  await expect(page.getByText(d['today.continueTitle'])).toBeVisible();
  // While a session is open, the secondary links are replaced by the banner.
  await expect(page.getByRole('button', { name: d['today.short'] })).toHaveCount(0);

  await page.getByRole('button', { name: d['today.continueAction'] }).click();
  await expect(page.getByText('Set 2 of', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: d['workout.exit'] }).click();
  await page.getByRole('button', { name: d['workout.exitFinish'] }).click();
  await page.getByRole('button', { name: d['workout.finishConfirm'] }).click();
  await expect(page.getByRole('heading', { name: d['done.title'] })).toBeVisible();
  await expect(page.getByText(d['done.early'])).toBeVisible();
  await expect(page.locator('.stat-grid__item').filter({ hasText: d['done.sets'] })).toContainText(/1 \/ \d+/);
});

test('discarding a session needs one confirmation and brings START back', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 5 });
  await page.getByRole('button', { name: d['today.short'] }).click();
  await expect(page.getByText('Exercise 1 /', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: d['workout.exit'] }).click();
  await page.getByRole('button', { name: d['workout.exitDiscard'] }).click();
  await expect(page.getByText(d['workout.discardText'])).toBeVisible();
  await page.getByRole('button', { name: d['workout.discardConfirm'], exact: true }).click();
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByText(d['today.continueTitle'])).toHaveCount(0);
});

test('"Feeling off" makes the plan lighter before the first set and can be undone', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en', { max: 8 });
  await page.getByTestId('start').click();
  const sets = page.locator('.workout__head .t-eyebrow');
  const before = await sets.textContent();
  const toggle = page.getByRole('switch', { name: d['workout.lighter'] });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(d['workout.lighterOn'])).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(sets).toHaveText(before ?? '');
});

test('rest today instead → recovery day (on plan); undo brings the workout back', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en');
  await page.getByRole('button', { name: d['today.restInstead'] }).click();
  await expect(page.getByRole('dialog', { name: d['today.restTitle'] })).toBeVisible();
  await page.getByRole('button', { name: d['reason.tired'] }).click();
  await page.getByRole('button', { name: d['today.restConfirm'], exact: true }).click();

  await expect(page.getByRole('heading', { name: d['today.recoveryTitle'] })).toBeVisible();
  await expect(page.getByText(d['reason.tired'])).toBeVisible();
  await expect(today(page)).toHaveAttribute('data-state', 'recovery');
  await expect(page.getByRole('button', { name: d['today.lightMobility'] })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: d['today.recoveryTitle'] })).toBeVisible();
  await page.getByRole('button', { name: d['today.recoveryUndo'] }).click();
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(today(page)).toHaveAttribute('data-state', 'today');
});

test('planned rest day: light mobility first, "train anyway" starts the next workout early', async ({ page }) => {
  await page.clock.install({ time: WEDNESDAY });
  await onboard(page, 'en');
  await expect(page.getByRole('heading', { name: d['today.restPlannedTitle'] })).toBeVisible();
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect(page.getByRole('button', { name: d['today.lightMobility'] })).toBeVisible();
  await page.getByRole('button', { name: 'Train anyway: Pull · Volume' }).click();
  await expect(page.getByText('Exercise 1 /', { exact: false })).toBeVisible();
});
