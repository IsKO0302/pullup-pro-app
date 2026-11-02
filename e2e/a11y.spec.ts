/**
 * Keyboard-only use and motion (spec §12–13), on the desktop project:
 * every step of the main loop is reachable with Tab, shows the silver focus
 * ring and works with Enter / Space / arrow keys; reduced motion stops all
 * animation while the normal START keeps its slow glow.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { LANGUAGE_NAMES } from '../src/data/i18n';
import { dict, onboard } from './helpers';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'keyboard flows run on the desktop project');
});

const d = dict.en;
const MONDAY = new Date('2026-01-12T10:00:00');

/** Presses Tab until `target` has focus (fails if it is not reachable), then checks the focus ring. */
async function tabTo(page: Page, target: Locator, max = 80) {
  await expect(target).toBeVisible();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      const ring = await target.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), visible: el.matches(':focus-visible') };
      });
      expect(ring.visible, 'keyboard focus is :focus-visible').toBe(true);
      expect(ring.style).not.toBe('none');
      expect(ring.width).toBeGreaterThanOrEqual(2);
      return;
    }
  }
  throw new Error(`not reachable with Tab: ${String(target)}`);
}

async function press(page: Page, target: Locator, key: 'Enter' | 'Space' = 'Enter') {
  await tabTo(page, target);
  await page.keyboard.press(key);
}

const navLink = (page: Page, key: 'nav.progress' | 'nav.thoughts' | 'nav.you') =>
  page.getByRole('navigation', { name: d['nav.label'] }).getByRole('link', { name: d[key] });

test('the whole loop works with the keyboard alone, with a visible focus ring', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await page.goto('/');
  await press(page, page.getByRole('button', { name: LANGUAGE_NAMES.en }));
  await press(page, page.getByRole('button', { name: d['common.continue'] }));

  // Setup: stepper, toggle chips, radio group with arrow keys, text field.
  const more = page.getByRole('button', { name: d['workout.more'] });
  await tabTo(page, more);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
  await press(page, page.getByRole('button', { name: d['common.next'] }));
  const rings = page.getByRole('button', { name: d['equipment.rings'] });
  await press(page, rings, 'Space');
  await expect(rings).toHaveAttribute('aria-pressed', 'true');
  await press(page, page.getByRole('button', { name: d['common.next'] }));
  const four = page.getByRole('radio', { name: '4', exact: true });
  await tabTo(page, four); // the selected radio is the group's only Tab stop
  await page.keyboard.press('ArrowRight');
  const five = page.getByRole('radio', { name: '5', exact: true });
  await expect(five).toHaveAttribute('aria-checked', 'true');
  await expect(five).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(four).toHaveAttribute('aria-checked', 'true');
  await tabTo(page, page.getByRole('textbox'));
  await page.keyboard.type('Isa');
  await press(page, page.getByRole('button', { name: d['setup.finish'] }));

  // TODAY → START → one set → skip rest → leave → finish now.
  await press(page, page.getByTestId('start'));
  await press(page, page.getByTestId('set-done'));
  await press(page, page.getByRole('button', { name: d['workout.restSkip'] }));
  await expect(page.getByText('Set 2 of', { exact: false })).toBeVisible();
  await press(page, page.getByRole('button', { name: d['workout.howTo'] }));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await press(page, page.getByRole('button', { name: d['workout.exit'] }));
  await press(page, page.getByRole('button', { name: d['workout.exitFinish'] }));
  await press(page, page.getByRole('button', { name: d['workout.finishConfirm'] }));
  await expect(page.getByRole('heading', { name: d['done.title'] })).toBeVisible();

  // COMPLETION: mood with Space, one line, Done.
  const strong = page.getByRole('button', { name: d['mood.5'] });
  await press(page, strong, 'Space');
  await expect(strong).toHaveAttribute('aria-pressed', 'true');
  await tabTo(page, page.getByRole('textbox'));
  await page.keyboard.type('Keyboard only.');
  await press(page, page.getByRole('button', { name: d['done.finish'], exact: true }));
  await expect(page.getByText(d['today.doneTitle'])).toBeVisible();

  // Tabs: PROGRESS shows the note; THOUGHTS: open one and favorite it; YOU: change language with arrows.
  await press(page, navLink(page, 'nav.progress'));
  await expect(page.getByText('Keyboard only.')).toBeVisible();
  await press(page, navLink(page, 'nav.thoughts'));
  await press(page, page.locator('.thought-item').first());
  const fav = page.getByRole('button', { name: d['thoughts.favorite'] });
  await press(page, fav, 'Space');
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await press(page, navLink(page, 'nav.you'));
  await tabTo(page, page.getByRole('radio', { name: LANGUAGE_NAMES.en }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: dict.ru['you.title'], level: 1 })).toBeVisible();
  await expect(page.getByRole('radio', { name: LANGUAGE_NAMES.ru })).toBeFocused();
});

test('motion: START glows slowly; with reduced motion nothing keeps moving', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page, 'en');
  const start = page.getByTestId('start');
  const glow = () => start.evaluate((el) => el.getAnimations().map((a) => ({
    name: (a as CSSAnimation).animationName,
    duration: Number(a.effect?.getTiming().duration ?? 0),
    state: a.playState,
  })));
  const normal = await glow();
  expect(normal).toContainEqual(expect.objectContaining({ name: 'start-glow', state: 'running' }));
  expect(normal.find((a) => a.name === 'start-glow')!.duration).toBeGreaterThanOrEqual(4000); // very slow

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(start).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  await expect.poll(glow).not.toContainEqual(expect.objectContaining({ state: 'running' }));
});
