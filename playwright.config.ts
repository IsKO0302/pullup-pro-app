import { defineConfig } from '@playwright/test';

// Uses a system Chromium when CHROMIUM_PATH is set (sandbox), otherwise the
// browser installed by `npx playwright install chromium`.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath },
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  // E2E runs against a production build that uses a SEPARATE database name
  // (VITE_DB_NAME in .env.e2e) and every test gets a fresh, isolated context.
  webServer: {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 240_000,
  },
  projects: [
    { name: 'mobile', testIgnore: /screenshots\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } },
    { name: 'desktop', testIgnore: /screenshots\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
    { name: 'screenshots', testMatch: /screenshots\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
  ],
});
