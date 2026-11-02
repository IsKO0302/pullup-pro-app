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

## Data safety

- The real profile lives in the IndexedDB database `pullup-pro` in your browser.
- E2E tests build the app with `--mode e2e`, which uses a **different** database
  (`pullup-pro-e2e`, see `.env.e2e`), and every test runs in a fresh, isolated browser
  context. Unit tests use an in-memory IndexedDB with unique names. No test can touch
  your real data.
- Back up regularly: YOU → Data → Export everything. Import always takes an internal
  snapshot first.

## Project files

- `PROJECT.md` — status, what is verified and what is not.
- `DECISIONS.md` — non-obvious decisions.
- `IDEAS.md` — everything deliberately left out of v1.
- `CONTENT-REVIEW.md` — phrases that need review by a native speaker.
