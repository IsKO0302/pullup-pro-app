# PULLUP PRO

A quiet, offline-first pull-up training app. One person, every day, for years.
React + TypeScript (strict) + Vite, installable PWA, local data only (IndexedDB).

## Requirements

- Node.js 20.19+ (built and tested with Node 24) and npm.
- For end-to-end tests: a Chromium for Playwright (`npx playwright install chromium`),
  or set `CHROMIUM_PATH` to an existing Chromium/Chrome binary.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server (http://localhost:5173) | `npm run dev` |
| Type check | `npm run typecheck` |
| Lint (zero warnings) | `npm run lint` |
| Unit tests (Vitest) | `npm test` |
| Domain coverage (≥ 90 %) | `npm run coverage` |
| Production build → `dist/` | `npm run build` |
| Preview the build (http://localhost:4173) | `npm run preview` |
| End-to-end tests (Playwright, 390×844 + 1280×800) | `npm run e2e` |
| Regenerate screenshots → `docs/screenshots/` | `npm run screenshots` |
| Everything except e2e | `npm run check` |

On Windows PowerShell with a custom browser: `$env:CHROMIUM_PATH="C:\path\to\chrome.exe"; npm run e2e`.

What the end-to-end specs cover: `onboarding`, `workout`, `progress`, `thoughts`, `poster`,
`data` (export / import / snapshots / reset), `pwa` (installability, offline, updates),
`qa` (every main state at 360 / 390 / 430 / 768 / 1280 px and 130 % text: no sideways
scrolling, nothing cut off, targets ≥ 48 px, axe-core audit, no English left on RU / TR
screens) and `a11y` (keyboard-only loop with focus rings, reduced motion).

`e2e/pwa.spec.ts` checks installability, offline use and a real service-worker update: it
copies the e2e build to a temporary folder, serves it from its own static server on a
free port, modifies `sw.js` to simulate the next release and removes the folder afterwards.

### Lighthouse (optional, not a dependency)

```bash
npm run build && npm run preview
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new --disable-dev-shm-usage" --view
```

`--disable-dev-shm-usage` is only needed in containers with a small `/dev/shm`. The last run
(mobile profile) is saved in `docs/lighthouse/first-launch-mobile.html`.

`npm audit` reports moderate advisories in build-time tooling only (glob / minimatch /
deepmerge under the PWA build plugin); `npm audit --omit=dev` — what ships — finds none.

## Data safety

- The real profile lives in the IndexedDB database `pullup-pro` in your browser.
- E2E tests build the app with `--mode e2e`, which uses a **different** database
  (`pullup-pro-e2e`, see `.env.e2e`), and every test runs in a fresh, isolated browser
  context. Unit tests use an in-memory IndexedDB with unique names. No test can touch
  your real data.

### Backup, import, reset

- **Export:** YOU → Data → "Export everything" downloads `pullup-pro-backup-YYYY-MM-DD.json`
  (readable JSON with format id, schema version, app version, export time in UTC + local
  date + time zone). A calm reminder appears on TODAY / YOU when 30 days passed since the
  last export.
- **Import:** YOU → Data → Import shows a preview first. *Merge* (default) only adds what
  is missing on this device; *Replace* makes this device exactly the file. Damaged,
  foreign or newer-version files are refused and nothing changes.
- **Snapshots:** before every import, reset or restore the current data is copied
  automatically (newest 3 kept, same database transaction as the change). YOU → Data →
  Snapshots → Restore brings a copy back.
- **Reset everything** needs two confirmations. Right after a reset the first screen offers
  "Undo the reset" and "Restore from a backup file".
- **Storage protection:** after the first workout the app asks the browser to keep its
  data (`navigator.storage.persist()`); the status is shown in YOU → Data. Installing the
  app to the home screen usually helps. Still export now and then — the backup file is
  the only copy outside this browser.

### Offline and updates

The production build precaches the whole app (service worker), so it opens and works
without a network after the first visit. A new version downloads in the background and
is applied only when you tap "Restart now" on TODAY or YOU — never during a workout.

### Demo data (development only)

To look at PROGRESS with months of history, run the dev server on a **separate**
database and seed it from the browser console:

```bash
VITE_DB_NAME=pullup-pro-dev npm run dev
```

```js
await window.__pullupTest.seedDemo({ today: '2026-03-18', lang: 'en', weeks: 10 })
```

The hook exists only in dev/e2e builds running on a database other than `pullup-pro`,
and it refuses the real database name even if called directly. Production builds do
not contain it.

## Project files

- `PROJECT.md` — status, what is verified and what is not.
- `DECISIONS.md` — non-obvious decisions.
- `IDEAS.md` — everything deliberately left out of v1.
- `CONTENT-REVIEW.md` — phrases that need review by a native speaker.
- `docs/screenshots/` — TODAY, WORKOUT, COMPLETION, PROGRESS, THOUGHTS, POSTER in EN / RU / TR
  (390 × 844, 2×) and poster samples; `docs/lighthouse/` — the last Lighthouse report.
- `src/data/thoughts.ts` — the 90 PULLUP PRO ORIGINALS (EN/RU/TR); rules in `src/data/thoughts.test.ts`.
