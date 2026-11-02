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
