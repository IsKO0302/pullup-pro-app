# PULLUP PRO — project status

Personal calisthenics app focused on pull-ups for Isa. Open → today's workout → START →
one exercise at a time → finish → real numbers + one thought. Offline-first PWA, local
data only. Full specification: master build prompt + "final engineering & product guardrails".

## Environment (checked in Phase 0)

| Capability | Status |
| --- | --- |
| Access to `D:\ISA_SPORT\pullup-pro-app\` | **No** — Linux sandbox, no Windows drive. Built in `/data/pullup-pro-app`, delivered as a zip (D1). |
| Create files, run terminal commands | Yes |
| Install npm packages | Yes (public npm registry reachable) |
| Dev server / preview server | Yes (inside the sandbox) |
| Browser for tests and screenshots | Yes — headless Chrome for Testing 153 via Playwright |
| Git | Yes (git 2.49) |
| Real phone / real PWA installation | **No** |
| Native-speaker language review | **No** (see CONTENT-REVIEW.md) |

## How to run
See README.md.

## Phase log

### Phase 0 — Environment + foundation
- DONE: Vite + React 19 + TypeScript 6 (strict) project, ESLint with layer boundaries, Vitest, Playwright config, PWA plugin, icons, README/PROJECT/DECISIONS/IDEAS, git.
- VERIFIED: `npm run typecheck`, `npm run lint`, `npm test` (5 tests), `npm run build` pass; dev server served the themed shell (headless Chromium screenshot).
- NOT VERIFIED: nothing user-facing yet.

### Phase 1 — Design system + shell
- DONE: tokens (colors, type scale, spacing, motion), self-hosted fonts, Button/IconButton, Chip/ChoiceGroup, Stepper, BottomNav, Sheet (native dialog), Ring timer, ProgressBar, Skeleton, Switch, EmptyState, Banner, reduced-motion handling, hash router, dev-only `#/styleguide` (EN/RU/TR strings) and `#/glyphs`.
- VERIFIED: contrast test (22 pairs ≥ 4.5:1) passes; typecheck + lint clean; styleguide and glyph pages rendered in headless Chromium at 390 px (Cyrillic ё/Ё and Turkish ı İ ş ğ ç ö ü in both fonts; `toLocaleUpperCase('tr')` → İSTANBUL).
- NOT VERIFIED: real-device rendering (iOS/Android fonts), screen readers.

### Phase 2 — i18n + first launch
- DONE: typed EN/RU/TR dictionaries (~470 keys, shared key type → missing key = compile error), `createI18n` (interpolation, Intl plural rules, locale dates without time-zone drift, `toLocaleUpperCase`), IndexedDB store (versioned schema v2 with a tested migration, serialised write-then-apply store, atomic completion), language screen (text labels, no flags), welcome (line-by-line fade, reduced-motion aware), 3 skippable setup screens (resumable after reload, `0` stored as a real answer, skip keeps defaults), app shell with bottom navigation, YOU subset (instant language switch, replay welcome, safety, version), error boundary, storage-error screen, save-error toast.
- VERIFIED: unit tests — key parity, no empty values, identical placeholders, RU/EN/TR plurals, Turkish upper case, date formatting, storage round-trips, atomic completion rollback, v1→v2 migration preserving records (fake-indexeddb, throw-away DB names). E2E (Chromium, mobile 390×844 + desktop): first launch → TODAY in < 60 s in EN/RU/TR (≈2 s automated), persisted after reload, onboarding resumes on the same step, language switch without reload; all against the separate `pullup-pro-e2e` database.
- NOT VERIFIED: real phones; screen-reader pass (planned in phase 9).
