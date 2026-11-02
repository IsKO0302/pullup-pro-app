import { expect, test, type Page } from '@playwright/test';
import { THOUGHTS_BY_ID } from '../src/data/thoughts';
import { COMPLETION_CATEGORIES, REST_CATEGORIES } from '../src/domain/thoughts';
import type { Lang } from '../src/domain/types';
import { dict, onboard, runToCompletion } from './helpers';

const d = dict.en;
const idOf = async (page: Page, selector: string) => (await page.locator(selector).first().getAttribute('data-thought-id'))!;
const todayThought = (page: Page) => idOf(page, '.today-thought');
const heroThought = (page: Page) => idOf(page, '[data-testid="thought-of-day"]');

const openThoughts = async (page: Page, lang: Lang = 'en') => {
  await page.getByRole('navigation', { name: dict[lang]['nav.label'] }).getByRole('link', { name: dict[lang]['nav.thoughts'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: dict[lang]['thoughts.title'] })).toBeVisible();
};

test.describe('thought of the day (Asia/Tokyo, local midnight ≠ UTC midnight)', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });

  test('same thought all local day, through reloads; a new one right after local midnight', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-12T23:58:00+09:00') });
    await onboard(page, 'en');
    const first = await todayThought(page);
    expect(THOUGHTS_BY_ID.get(first)?.format).toBe('short');
    await expect(page.locator('.today-thought')).toContainText(THOUGHTS_BY_ID.get(first)!.text.en);

    await page.reload();
    await expect(page.locator('.today-thought')).toBeVisible();
    expect(await todayThought(page)).toBe(first);
    await openThoughts(page);
    expect(await heroThought(page)).toBe(first);
    await expect(page.getByTestId('thought-of-day')).toContainText('12 January');

    // Cross local midnight while the screen is open: it switches by itself.
    await page.clock.runFor(150_000);
    await expect(page.getByTestId('thought-of-day')).toContainText('13 January');
    const second = await heroThought(page);
    expect(second).not.toBe(first);

    // …and then stays the same for the rest of that day, also after a reload.
    await page.clock.fastForward('12:00:00');
    await page.reload();
    await expect(page.getByTestId('thought-of-day')).toContainText('13 January');
    expect(await heroThought(page)).toBe(second);
    await page.getByRole('navigation', { name: d['nav.label'] }).getByRole('link', { name: d['nav.today'] }).click();
    expect(await todayThought(page)).toBe(second);

    // Tapping it on TODAY opens it in THOUGHTS.
    await page.locator('.today-thought').click();
    await expect(page.locator('blockquote')).toHaveText(THOUGHTS_BY_ID.get(second)!.text.en);
    await expect(page.getByText(`${d['thoughts.ofDay']} ·`)).toBeVisible();
  });
});

test('favorites persist after reload; recently viewed; topic filter; keyboard tabs', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  await openThoughts(page);
  await expect(page.getByText('90 thoughts')).toBeVisible();
  await expect(page.locator('.thought-item')).toHaveCount(90);
  await expect(page.locator('.thought-item .originals')).toHaveCount(90);

  await page.getByRole('radio', { name: d['category.patience'], exact: true }).click();
  await expect(page.getByText('6 thoughts')).toBeVisible();
  await expect(page.locator('.thought-item')).toHaveCount(6);
  for (const id of await page.locator('.thought-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-thought-id')))) {
    expect(THOUGHTS_BY_ID.get(id!)!.category).toBe('patience');
  }

  // Open one, make it a favorite.
  const item = page.locator('.thought-item').nth(1);
  const id = (await item.getAttribute('data-thought-id'))!;
  await item.click();
  await expect(page.locator('blockquote')).toHaveText(THOUGHTS_BY_ID.get(id)!.text.en);
  const heart = page.getByRole('button', { name: d['thoughts.favorite'] });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');

  // Back keeps the chosen topic.
  await page.getByRole('button', { name: d['common.back'] }).click();
  await expect(page.getByRole('radio', { name: d['category.patience'], exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator(`.thought-item[data-thought-id="${id}"] .thought-item__fav`)).toBeVisible();

  await page.reload();
  await openThoughts(page);
  const favTab = page.getByRole('tab', { name: d['thoughts.favorites'] });
  await page.getByRole('tab', { name: d['thoughts.all'] }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(favTab).toHaveAttribute('aria-selected', 'true');
  await expect(favTab).toBeFocused();
  await expect(page.locator('#thoughts-panel .thought-item')).toHaveCount(1);
  await expect(page.locator('#thoughts-panel .thought-item')).toHaveAttribute('data-thought-id', id);

  // Recently viewed: newest first, no duplicates.
  await page.getByRole('tab', { name: d['thoughts.all'] }).click();
  await page.locator('.thought-item').first().click();
  const other = await idOf(page, 'blockquote');
  await page.getByRole('button', { name: d['common.back'] }).click();
  await page.getByRole('tab', { name: d['thoughts.recent'] }).click();
  await expect(page.locator('.thought-item')).toHaveCount(2);
  expect(await page.locator('.thought-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-thought-id')))).toEqual([other, id]);

  // Un-favorite → a helpful empty state that leads back to the library.
  await page.goto(`/#/thoughts/${id}`);
  await page.getByRole('button', { name: d['thoughts.favorite'] }).click();
  await expect(page.getByRole('button', { name: d['thoughts.favorite'] })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: d['common.back'] }).click();
  await page.getByRole('tab', { name: d['thoughts.favorites'] }).click();
  await expect(page.getByText(d['thoughts.favoritesEmptyTitle'])).toBeVisible();
  await page.getByRole('button', { name: d['thoughts.browseAll'] }).click();
  await expect(page.getByRole('tab', { name: d['thoughts.all'] })).toHaveAttribute('aria-selected', 'true');
});

test('share: Web Share when available, otherwise copy to the clipboard', async ({ page, context, browserName }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  const text = THOUGHTS_BY_ID.get('time-1')!.text.en;

  // 1) No Web Share → clipboard + a quiet confirmation.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }));
  await page.goto('/#/thoughts/time-1');
  await page.getByRole('button', { name: d['thoughts.share'] }).click();
  await expect(page.getByRole('status').filter({ hasText: d['thoughts.copied'] })).toBeVisible();
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${text}\n\nPULLUP PRO ORIGINALS`);

  // 2) Web Share available → the system sheet gets the text.
  await page.evaluate(() => {
    const w = window as unknown as { shared: ShareData[] };
    w.shared = [];
    Object.defineProperty(Navigator.prototype, 'share', { value: async (data: ShareData) => { w.shared.push(data); }, configurable: true });
  });
  await page.getByRole('button', { name: d['thoughts.share'] }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared: ShareData[] }).shared)).toEqual([{ text: `${text}\n\nPULLUP PRO ORIGINALS` }]);
});

test('rest timer shows a different short thought for every rest; completion shows one thought', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en', { max: 5 });
  await page.getByTestId('start').click();
  await page.getByTestId('set-done').click();
  const restThought = page.locator('.rest__thought');
  await expect(restThought).toBeVisible();
  const first = await idOf(page, '.rest__thought');
  expect(THOUGHTS_BY_ID.get(first)!.format).toBe('short');
  expect(REST_CATEGORIES).toContain(THOUGHTS_BY_ID.get(first)!.category);
  await expect(restThought).toHaveText(THOUGHTS_BY_ID.get(first)!.text.en);

  await page.reload();
  await expect(restThought).toBeVisible();
  expect(await idOf(page, '.rest__thought')).toBe(first);

  await page.getByRole('button', { name: d['workout.restSkip'] }).click();
  await page.getByTestId('set-done').click();
  await expect(restThought).toBeVisible();
  expect(await idOf(page, '.rest__thought')).not.toBe(first);

  await runToCompletion(page);
  const done = page.locator('.done__thought');
  await expect(done).toBeVisible();
  const id = (await done.getAttribute('data-thought-id'))!;
  expect(COMPLETION_CATEGORIES).toContain(THOUGHTS_BY_ID.get(id)!.category);
  await expect(done.locator('blockquote')).toHaveText(THOUGHTS_BY_ID.get(id)!.text.en);
  await expect(done).toContainText('PULLUP PRO ORIGINALS');
});

for (const lang of ['ru', 'tr'] as const) {
  test(`${lang.toUpperCase()}: thoughts, topics and detail are fully translated`, async ({ page }) => {
    const L = dict[lang];
    await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
    await onboard(page, lang);
    const id = await todayThought(page);
    await expect(page.locator('.today-thought')).toContainText(L['thoughts.ofDay']);
    await expect(page.locator('.today-thought')).toContainText(THOUGHTS_BY_ID.get(id)!.text[lang]);
    await openThoughts(page, lang);
    await expect(page.getByTestId('thought-of-day')).toContainText(THOUGHTS_BY_ID.get(id)!.text[lang]);
    for (const key of ['thoughts.all', 'thoughts.favorites', 'thoughts.recent'] as const) {
      await expect(page.getByRole('tab', { name: L[key] })).toBeVisible();
    }
    await page.getByRole('radio', { name: L['category.innerStrength'], exact: true }).click();
    await expect(page.locator('.thought-item')).toHaveCount(6);
    await expect(page.locator('.thought-item').first()).toContainText(L['category.innerStrength']);
    await page.locator('.thought-item').first().click();
    const shown = await idOf(page, 'blockquote');
    await expect(page.locator('blockquote')).toHaveText(THOUGHTS_BY_ID.get(shown)!.text[lang]);
    await expect(page.getByRole('button', { name: L['thoughts.favorite'] })).toBeVisible();
    // Nothing English leaks into the screen (category, buttons, labels).
    const body = await page.locator('main').innerText();
    for (const en of [d['thoughts.share'], d['common.back'], d['category.innerStrength']]) expect(body).not.toContain(en);
  });
}
