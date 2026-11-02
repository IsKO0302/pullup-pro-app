import { expect, type Page } from '@playwright/test';
import { DICTIONARIES, LANGUAGE_NAMES } from '../src/data/i18n';
import type { Lang } from '../src/domain/types';

export const dict = DICTIONARIES;

export interface OnboardOptions {
  max?: number;
  days?: number;
  name?: string;
  /** Start URL (default: the e2e preview server). */
  url?: string;
}

/** Fresh first launch through language → welcome → 3 setup screens → TODAY. */
export async function onboard(page: Page, lang: Lang = 'en', opts: OnboardOptions = {}) {
  const d = DICTIONARIES[lang];
  await page.goto(opts.url ?? '/');
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

/** The e2e build's database (see .env.e2e) — never the real "pullup-pro". */
export const E2E_DB = 'pullup-pro-e2e';

export interface DbDump {
  data: Record<'kv' | 'workouts' | 'recoveryDays' | 'thoughtDays', [IDBValidKey, unknown][]>;
  snapshots: number;
}

/** Reads every data store straight from IndexedDB (key order is deterministic). */
export async function dumpDb(page: Page): Promise<DbDump> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const read = (store: string) => new Promise<[IDBValidKey, unknown][]>((resolve, reject) => {
      const tx = db.transaction(store);
      const keys = tx.objectStore(store).getAllKeys();
      const values = tx.objectStore(store).getAll();
      tx.oncomplete = () => resolve(keys.result.map((k, i) => [k, values.result[i]]));
      tx.onerror = () => reject(tx.error);
    });
    const data = { kv: await read('kv'), workouts: await read('workouts'), recoveryDays: await read('recoveryDays'), thoughtDays: await read('thoughtDays') };
    const snapshots = (await read('snapshots')).length;
    db.close();
    return { data, snapshots };
  }, E2E_DB);
}

/** A kv value from a dump. */
export function kvOf<T>(dump: DbDump, key: string): T | undefined {
  return dump.data.kv.find(([k]) => k === key)?.[1] as T | undefined;
}

interface UpdateHooks { simulateUpdate: () => void; updatesApplied: number }
/** Dev/e2e hook: pretend a new version is waiting (see src/app/dev/hooks.ts). */
export const simulateUpdate = (page: Page) => page.evaluate(() => (window as unknown as { __pullupTest: UpdateHooks }).__pullupTest.simulateUpdate());
/** How many "Restart now" taps actually applied the (simulated) update. */
export const updatesApplied = (page: Page) => page.evaluate(() => (window as unknown as { __pullupTest: UpdateHooks }).__pullupTest.updatesApplied);
