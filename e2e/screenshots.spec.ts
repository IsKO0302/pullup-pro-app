/**
 * Documentation screenshots (spec §17): TODAY, WORKOUT (set + rest), COMPLETION,
 * PROGRESS, THOUGHTS and POSTER in EN / RU / TR at 390×844 (2×) → docs/screenshots/.
 * Run with `npm run screenshots`. Uses the e2e database and deterministic demo history.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Lang } from '../src/domain/types';
import { dict, seedDemo } from './helpers';

const THURSDAY = new Date('2026-03-19T09:30:00');
const NOTE: Record<Lang, string> = { en: 'Slow and clean. Last set was the best.', ru: 'Медленно и чисто. Последний подход — лучший.', tr: 'Yavaş ve temiz. Son set en iyisiydi.' };

const shot = async (page: Page, name: string, lang: Lang) => {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `docs/screenshots/${name}-${lang}.png` });
};

/** Like runToCompletion, but with believable time: ~40 s per set, the planned rest up to 90 s. */
async function train(page: Page, lang: Lang) {
  const d = dict[lang];
  const title = page.getByRole('heading', { name: d['done.title'] });
  for (let guard = 0; guard < 200 && !(await title.isVisible()); guard++) {
    const skipRest = page.getByRole('button', { name: d['workout.restSkip'] });
    if (await skipRest.isVisible()) {
      await page.clock.runFor(90_000);
      if (await skipRest.isVisible()) await skipRest.click();
      continue;
    }
    const startTimer = page.getByRole('button', { name: d['workout.timerStart'] });
    if (await startTimer.isVisible()) {
      await startTimer.click();
      await page.clock.runFor(20_000);
      const stop = page.getByRole('button', { name: d['workout.timerStop'] });
      if (await stop.isVisible()) await stop.click();
    }
    const setDone = page.getByTestId('set-done');
    if (await setDone.isVisible()) {
      await page.clock.runFor(40_000);
      await setDone.click();
    } else {
      await page.waitForTimeout(50);
    }
  }
  await expect(title).toBeVisible();
}

const nav = (page: Page, lang: Lang, key: 'nav.progress' | 'nav.thoughts') =>
  page.getByRole('navigation', { name: dict[lang]['nav.label'] }).getByRole('link', { name: dict[lang][key] }).click();

for (const lang of ['en', 'ru', 'tr'] as const) {
  test(`screens in ${lang.toUpperCase()}`, async ({ page }) => {
    const d = dict[lang];
    await page.emulateMedia({ reducedMotion: 'reduce' }); // no half-finished fades in the pictures
    await page.clock.install({ time: THURSDAY });
    await seedDemo(page, { today: '2026-03-19', lang, weeks: 12 });
    await page.goto('/#/today');
    await expect(page.getByTestId('start')).toBeVisible();
    await shot(page, 'today', lang);

    await page.getByTestId('start').click();
    await expect(page.getByTestId('set-done')).toBeVisible();
    await shot(page, 'workout', lang);
    await page.getByTestId('set-done').click();
    await expect(page.getByRole('button', { name: d['workout.restSkip'] })).toBeVisible();
    await page.clock.runFor(14_000);
    await shot(page, 'workout-rest', lang);

    await train(page, lang);
    await page.getByRole('button', { name: d['mood.4'] }).click();
    await page.getByRole('textbox').fill(NOTE[lang]);
    await page.getByRole('textbox').blur();
    await shot(page, 'completion', lang);
    await page.getByRole('button', { name: d['done.finish'], exact: true }).click();

    await nav(page, lang, 'nav.progress');
    await expect(page.getByRole('heading', { name: d['progress.title'], level: 1 })).toBeVisible();
    await shot(page, 'progress', lang);

    await nav(page, lang, 'nav.thoughts');
    await expect(page.getByTestId('thought-of-day')).toBeVisible();
    await shot(page, 'thoughts', lang);

    await page.getByTestId('thought-of-day').click();
    await page.getByRole('button', { name: d['thoughts.makePoster'] }).click();
    await expect(page.getByRole('img', { name: new RegExp(`^${d['poster.preview']}`) })).toBeVisible();
    await shot(page, 'poster', lang);
  });
}
