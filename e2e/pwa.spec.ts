import { expect, test, type Page } from '@playwright/test';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { dict, dumpDb, onboard, seedDemo } from './helpers';

const d = dict.en;
const nav = (page: Page) => page.getByRole('navigation', { name: d['nav.label'] });

async function controlledBySw(page: Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('installable: manifest, icons and service worker pass Chromium’s installability check', async ({ page }) => {
  await page.goto('/');
  await controlledBySw(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors') as { installabilityErrors: { errorId: string }[] };
  // Playwright contexts are incognito-like; that one error is about the test browser, not the app.
  expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'PULLUP PRO', short_name: 'PULLUP PRO', display: 'standalone', start_url: './', theme_color: '#08090B' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const icon of manifest.icons as { src: string }[]) expect((await page.request.get(`/${icon.src}`)).status()).toBe(200);
});

test('works with the network off: reload, every tab, a thought and its poster', async ({ page, context }) => {
  await seedDemo(page, { today: '2026-03-18', weeks: 6 });
  await controlledBySw(page);
  const before = await dumpDb(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(nav(page)).toBeVisible();
    await expect(page.locator('.today-thought')).toBeVisible();
    await page.getByRole('link', { name: d['nav.progress'] }).click();
    await expect(page.getByRole('heading', { name: d['progress.title'], level: 1 })).toBeVisible();
    await page.getByRole('link', { name: d['nav.you'] }).click();
    await expect(page.getByRole('heading', { name: d['you.title'], level: 1 })).toBeVisible();
    await page.getByRole('link', { name: d['nav.thoughts'] }).click();
    await page.locator('a.thought-item').first().click();
    await page.getByRole('button', { name: d['thoughts.makePoster'] }).click();
    await expect(page.locator('canvas[data-ready="true"]')).toBeVisible();
    await expect(page.locator('canvas')).toHaveAttribute('data-overflow', 'false');
    // The poster fonts came from the precache, not the network.
    expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Cormorant') && f.status === 'loaded'))).toBe(true);
    expect((await dumpDb(page)).data.workouts).toEqual(before.data.workouts);
  } finally {
    await context.setOffline(false);
  }
});

// ── A REAL new version, served by a private static server (its own origin, its own copy of the build) ──

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain',
};

function serve(root: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` })));
}

test('a real new version is found, waits during a workout and is applied by “Restart now”', async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), 'pullup-pwa-'));
  cpSync('dist-e2e', root, { recursive: true });
  const { server, url } = await serve(root);
  try {
    await onboard(page, 'en', { url });
    await controlledBySw(page);
    await page.evaluate(() => { (window as unknown as { marker: string }).marker = 'same page'; });

    // A workout is running when the new version is published.
    await page.getByTestId('start').click();
    await page.getByTestId('set-done').click();
    appendFileSync(join(root, 'sw.js'), '\n// next release\n');
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), { timeout: 20_000 }).toBe(true);

    // Nothing interrupts the workout: same page, no prompt; YOU explains that the update waits.
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('same page');
    await expect(page.getByRole('button', { name: d['workout.restSkip'] })).toBeVisible();
    await expect(page.getByTestId('update-ready')).toBeHidden();
    await page.goto(`${url}#/you`);
    await expect(page.getByTestId('update-waits')).toHaveText(d['you.updateBlocked']);

    // Finished → TODAY offers the update → it activates and the app reloads with the data intact.
    await page.getByRole('link', { name: d['nav.today'] }).click();
    await page.getByRole('button', { name: d['today.continueAction'] }).click();
    await page.getByRole('button', { name: d['workout.exit'] }).click();
    await page.getByRole('button', { name: d['workout.exitFinish'] }).click();
    await page.getByRole('button', { name: d['workout.finishConfirm'] }).click();
    await page.getByRole('button', { name: d['done.finish'] }).click();
    const banner = page.getByTestId('update-ready');
    await expect(banner).toBeVisible();
    const reloaded = page.waitForEvent('load');
    await banner.getByRole('button', { name: d['you.updateAction'] }).click();
    await reloaded;
    await expect(nav(page)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker ?? 'reloaded')).toBe('reloaded');
    await expect(page.getByText(d['today.doneTitle'])).toBeVisible();
    await expect(banner).toBeHidden();
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting ?? null)).toBeNull();
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
