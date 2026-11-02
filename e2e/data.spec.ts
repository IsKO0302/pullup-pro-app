import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LANGUAGE_PICKER_LABEL } from '../src/data/i18n';
import { dict, dumpDb, kvOf, onboard, runToCompletion, seedDemo, simulateUpdate, updatesApplied } from './helpers';

// Guardrail 2: every test runs in a fresh browser context against the separate
// "pullup-pro-e2e" database; the real data is never touched.
const d = dict.en;
const TODAY = '2026-03-18';
const NOW = new Date(`${TODAY}T10:00:00`);

async function openYou(page: Page) {
  await page.getByRole('link', { name: d['nav.you'] }).click();
  await expect(page.getByRole('heading', { name: d['you.title'], level: 1 })).toBeVisible();
}

/** The real Export button → the downloaded file's text. */
async function exportFile(page: Page): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: d['you.export'] }).click()]);
  expect(download.suggestedFilename()).toBe(`pullup-pro-backup-${TODAY}.json`);
  const text = readFileSync((await download.path())!, 'utf8');
  await expect(page.getByTestId('data-status')).toHaveText(d['you.exportDone']);
  return text;
}

async function resetEverything(page: Page) {
  await page.getByRole('button', { name: d['you.reset'] }).click();
  await expect(page.getByRole('heading', { name: d['you.reset1Title'] })).toBeVisible();
  await page.getByRole('button', { name: d['you.reset1Confirm'] }).click();
  await expect(page.getByRole('heading', { name: d['you.reset2Title'] })).toBeVisible();
  await page.getByRole('button', { name: d['you.reset2Confirm'] }).click();
  await expect(page.getByRole('heading', { name: LANGUAGE_PICKER_LABEL })).toBeVisible();
}

const asFile = (text: string, name = 'backup.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });

async function seeded(page: Page) {
  await page.clock.install({ time: NOW });
  await seedDemo(page, { today: TODAY, weeks: 8 });
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  // TODAY pins the thought of the day on first view; wait for it so the state is settled.
  await expect.poll(async () => (await dumpDb(page)).data.thoughtDays.some(([k]) => k === TODAY)).toBe(true);
  await openYou(page);
}

test('export → reset (two confirmations) → restore from the file: the identical state comes back', async ({ page }) => {
  await seeded(page);
  const text = await exportFile(page);
  const file = JSON.parse(text);
  expect(file).toMatchObject({ format: 'pullup-pro-export', schemaVersion: 2, exportedLocalDate: TODAY });
  expect(file.data.workouts.length).toBeGreaterThan(20);
  expect(file.summary.workouts).toBe(file.data.workouts.length);
  await expect(page.getByTestId('last-export')).toContainText('18 March 2026');
  const afterExport = await dumpDb(page);
  expect(afterExport.snapshots).toBe(0);

  await resetEverything(page);
  const wiped = await dumpDb(page);
  expect(wiped.data.workouts).toEqual([]);
  expect(kvOf(wiped, 'profile')).toBeUndefined();
  expect(wiped.snapshots).toBe(1); // the automatic copy taken before the reset

  // A new phone / a fresh start: restore from the file on the very first screen.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: d['you.restoreFromFile'] }).click()]);
  await chooser.setFiles(asFile(text));
  await expect(page.getByTestId('import-preview')).toContainText(`${file.data.workouts.length} workouts`);
  await page.getByRole('button', { name: d['you.importRestore'] }).click();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  await expect(page.getByTestId('start').or(page.getByText(d['today.restPlannedTitle']))).toBeVisible();

  const restored = await dumpDb(page);
  expect(restored.data).toEqual(afterExport.data);
  await page.reload();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  expect((await dumpDb(page)).data).toEqual(afterExport.data);
});

test('a reset can be undone from the first screen (automatic snapshot)', async ({ page }) => {
  await seeded(page);
  const before = await dumpDb(page);
  await resetEverything(page);
  await page.getByRole('button', { name: 'Undo the reset from 18 March' }).click();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  expect((await dumpDb(page)).data).toEqual(before.data);
});

test('damaged, foreign or newer files are refused and change nothing', async ({ page }) => {
  await seeded(page);
  const good = await exportFile(page);
  const before = await dumpDb(page);
  const input = page.getByTestId('import-input');
  const damaged = JSON.parse(good);
  damaged.data.workouts[2].durationSec = -5;
  const newer = { ...JSON.parse(good), schemaVersion: 99 };
  const cases: [string, string][] = [
    ['{ not json', d['importError.notJson']],
    [JSON.stringify({ app: 'some other app', items: [] }), d['importError.notApp']],
    [JSON.stringify(damaged), 'part of it is damaged (workouts[2].durationSec)'],
    [JSON.stringify(newer), d['importError.newer']],
  ];
  for (const [text, message] of cases) {
    await input.setInputFiles(asFile(text));
    const error = page.getByTestId('import-error');
    await expect(error).toContainText(message);
    await expect(error).toContainText('Your data was not changed.');
    await page.getByRole('dialog').getByRole('button', { name: d['common.close'] }).last().click();
    await expect(error).toBeHidden();
  }
  expect(await dumpDb(page)).toEqual(before); // same data, and no snapshot was taken
});

test('merge adds only what is missing; the pre-import snapshot restores the previous state', async ({ page }) => {
  await seeded(page);
  const text = await exportFile(page);
  const before = await dumpDb(page);
  const count = before.data.workouts.length;
  const file = JSON.parse(text);
  const firstId = file.data.workouts[0].id;
  file.data.workouts[0].note = 'Edited on the other phone';
  file.data.workouts.push({ ...file.data.workouts[1], id: 'other-phone-1', note: 'From the other phone' });

  await page.getByTestId('import-input').setInputFiles(asFile(JSON.stringify(file)));
  await expect(page.getByText('Adds what is missing here (1 workout). Nothing on this device is overwritten.')).toBeVisible();
  await page.getByRole('button', { name: d['you.importMerge'] }).click();
  await expect(page.getByTestId('data-status')).toHaveText(`Import complete. Your history now has ${count + 1} workouts.`);
  const merged = await dumpDb(page);
  expect(merged.data.workouts).toHaveLength(count + 1);
  const kept = merged.data.workouts.find(([k]) => k === firstId)?.[1] as { note: string };
  expect(kept.note).toBe((before.data.workouts.find(([k]) => k === firstId)?.[1] as { note: string }).note);
  expect(merged.snapshots).toBe(1);

  const rows = page.getByTestId('snapshots').getByRole('listitem');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Before import · `);
  await expect(rows.first()).toContainText(`${count} workouts`);
  await rows.first().getByRole('button', { name: d['you.snapshotRestore'] }).click();
  await expect(page.getByRole('heading', { name: d['you.restoreTitle'] })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: d['you.snapshotRestore'] }).click();
  await expect(page.getByTestId('data-status')).toHaveText(d['you.restoreDone']);
  const restored = await dumpDb(page);
  expect(restored.data).toEqual(before.data);
  expect(restored.snapshots).toBe(2); // the merged state was kept as well
  await expect(rows).toHaveCount(2);
});

test('backup reminder after ~30 days on TODAY: "Later" dismisses it, Export clears it', async ({ page }) => {
  await page.clock.install({ time: NOW });
  // Demo history whose last export was 39 days ago.
  await seedDemo(page, { today: '2026-02-10', weeks: 6 });
  const reminder = page.getByTestId('backup-reminder');
  await expect(reminder).toContainText(d['today.backupTitle']);
  await reminder.getByRole('button', { name: d['common.later'] }).click();
  await expect(reminder).toBeHidden();
  await page.reload();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  await expect(reminder).toBeHidden();
  await openYou(page);
  await expect(reminder).toBeHidden();

  // 31 days later it is back; exporting from TODAY clears it.
  await page.clock.setSystemTime(new Date('2026-04-19T10:00:00'));
  await page.goto('/#/today');
  await expect(reminder).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), reminder.getByRole('button', { name: d['today.backupAction'] }).click()]);
  expect(download.suggestedFilename()).toBe('pullup-pro-backup-2026-04-19.json');
  await expect(page.getByText(d['you.exportDone'])).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: d['nav.label'] })).toBeVisible();
  await expect(reminder).toBeHidden();
});

test('storage protection is requested after the first workout and explained in YOU', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  await openYou(page);
  await expect(page.getByTestId('persist-status')).toContainText(d['you.persistUnknown']);
  await page.getByRole('link', { name: d['nav.today'] }).click();
  await page.getByRole('button', { name: d['today.short'] }).click();
  await runToCompletion(page);
  await expect.poll(async () => kvOf<{ persist: string | null }>(await dumpDb(page), 'meta')?.persist).not.toBeNull();
  const persist = kvOf<{ persist: string }>(await dumpDb(page), 'meta')!.persist;
  expect(['granted', 'denied']).toContain(persist);
  await page.getByRole('button', { name: d['done.finish'] }).click();
  await openYou(page);
  await expect(page.getByTestId('persist-status')).toContainText(persist === 'granted' ? d['you.persistGranted'] : d['you.persistDenied']);
});

test('an update waits while a workout is active and is offered again afterwards', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-12T10:00:00') });
  await onboard(page, 'en');
  await simulateUpdate(page);
  const banner = page.getByTestId('update-ready');
  await expect(banner).toContainText(d['you.updateTitle']);

  await page.getByTestId('start').click();
  await page.getByTestId('set-done').click(); // one set logged
  await expect(page.getByRole('button', { name: d['workout.restSkip'] })).toBeVisible();
  await expect(banner).toBeHidden(); // never inside the workout
  await page.goto('/#/today');
  await expect(page.getByRole('button', { name: d['today.continueAction'] })).toBeVisible();
  await expect(banner).toBeHidden();
  await openYou(page);
  await expect(page.getByTestId('update-waits')).toHaveText(d['you.updateBlocked']);
  await expect(banner).toBeHidden();
  expect(await updatesApplied(page)).toBe(0);

  // Finish the workout → the prompt comes back; "Restart now" applies it.
  await page.getByRole('link', { name: d['nav.today'] }).click();
  await page.getByRole('button', { name: d['today.continueAction'] }).click();
  await page.getByRole('button', { name: d['workout.exit'] }).click();
  await page.getByRole('button', { name: d['workout.exitFinish'] }).click();
  await page.getByRole('button', { name: d['workout.finishConfirm'] }).click();
  await page.getByRole('button', { name: d['done.finish'] }).click();
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: d['you.updateAction'] }).click();
  expect(await updatesApplied(page)).toBe(1);
});
