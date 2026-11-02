# DECISIONS

Each entry: what, why, alternative rejected.

### D1 · Project location: `/data/pullup-pro-app` instead of `D:\ISA_SPORT\pullup-pro-app\`
The build agent runs in a Linux sandbox without access to the Windows drive `D:`; the path was checked and does not exist.
The project was built in the available workspace and is delivered as a zip (with git history) to unpack into `D:\ISA_SPORT\pullup-pro-app\`.
Rejected: pretending files were written to `D:`.

### D2 · TypeScript 6.0 (not 7.x)
`typescript-eslint` 8.72 supports TypeScript `< 6.1`; lint must stay clean and type-aware tooling must work.
Rejected: TypeScript 7 (native) — linting would break.

### D3 · Separate test storage
E2E builds use `--mode e2e` → IndexedDB `pullup-pro-e2e` (`.env.e2e`), and Playwright gives every test a fresh isolated context; Vitest uses `fake-indexeddb` with unique names.
Rejected: relying on isolated contexts alone (one mistake would hit the real profile).

### D4 · Playwright browser via `CHROMIUM_PATH`
The sandbox has a system Chrome for Testing; `playwright.config.ts` uses it when `CHROMIUM_PATH` is set, otherwise Playwright's own Chromium.
Rejected: hard-coding a sandbox path.

### D5 · Training weeks start on Monday, for all three languages
Weekly rhythm, lighter weeks and the week strip need one stable definition.
Rejected: locale-dependent week start (would change plans when the language changes).

### D6 · A workout belongs to the local date on which it STARTED
Stored as UTC instant + local date + IANA zone; never recomputed (a later zone change cannot move it).
Rejected: completion date (a session from 23:50 to 00:20 would jump to the next day).

### D7 · App icons are generated once from `public/favicon.svg` with ImageMagick and committed
No icon-generation dependency at build time.

### D8 · Plain global CSS with BEM-style class names (no CSS modules)
Small app, one design system; tokens are CSS custom properties, components have prefixed classes (`btn`, `chip`, `nav__item`).
Rejected: CSS modules / vanilla-extract — more tooling for no visible gain at this size.

### D9 · `--text-3` lightened to `#858C96`
The spec value `#707781` measures 3.57–4.41:1 on the four surfaces (below AA for small text); `#858C96` is ≥ 4.76:1 on all of them. Enforced by `src/ui/contrast.test.ts`.
Rejected: `#7B828C` (spec suggestion) — 4.16:1 on `--surface-3`.

### D10 · `--danger-text: #D27C7C` for red text; `--danger` stays for borders/solid buttons
`#C46B6B` text on `--surface-3` is 4.35:1. Solid danger buttons use dark text on `--danger` (5.37:1).

### D11 · Fonts: Inter Tight Variable (UI) + Cormorant Garamond 500/600 (quotes), self-hosted via @fontsource
Only Latin, Latin-Extended (Turkish ı İ ş ğ) and Cyrillic (ё Ё) subsets are imported for Cormorant; Inter Tight's variable CSS covers all subsets with unicode-range. Glyph coverage was checked on the dev page `#/glyphs` (screenshot). Cormorant digits are old-style, so all numbers use Inter Tight with tabular figures.

### D12 · Schema v2 adds `thoughtDays` and backfills `workouts.timeZone`
The thought of the day is pinned per local date (guardrail 7), so it gets its own store keyed by `localDate`. Added as a real migration (v1 → v2) instead of editing v1, and the test opens a v1 database with records, upgrades it and checks every record survived.

### D13 · Store writes are serialised and applied to memory only after IndexedDB confirms
Every action is queued; the in-memory state changes only after the transaction committed. If a write fails the UI keeps the previous (true) state and shows a calm toast. Slower by a few milliseconds, but the screen never shows data that is not on disk.

### D14 · First-launch steps are persisted in `profile.onboarding`
Closing the app in the middle of the setup resumes on the same step. "Skip" keeps whatever is stored (the defaults unless the user went back); a skipped pull-up question stores no max entry, which the engine treats as level 0 (the most conservative start).

### D15 · Exercise cues are general guidance — to be reviewed by the owner
44 exercises × 3 languages (name, 3 cues, one common mistake, safety notes on optional and demanding exercises) were written from general calisthenics coaching knowledge, not by a certified coach or physiotherapist. The app labels them as general guidance (no medical claims). The owner should review them before a public release; they are listed in CONTENT-REVIEW.md.

### D16 · Pull-up max = `strict-pullup` only; pull-up totals = strict, unassisted variations
The working max comes only from strict, unassisted pull-ups: setup answer, self-update, max tests and normal strict sets (guardrail 6). An honest lower self-report or test resets it. Chin-ups, wide/archer/weighted/high pull-ups (`family: 'pullup'`) count toward "pull-ups done" totals; band-assisted reps, negatives and muscle-ups are separate records and never touch the max.

### D17 · Fixed Monday-first weekly templates (no weekday picking in v1)
One template per 2–7 days/week (tested: right count, exactly one strength day, pull days never back to back, ≥ 1 recovery day at 6–7). Rejected for v1: choosing weekdays — one more setup step and more edge cases; parked in IDEAS.md.

### D18 · Strict-pull-up targets stay at least 2 reps below the working max
Max-based slots start at a fraction of the max (60 % strength, 50 % volume) and double progression may raise them only up to `max − 2` (2–3 reps in reserve, guardrail 4). Above that, progress comes from the max test (suggested every 4 weeks, never forced), an honest self-update or logging more reps than planned.

### D19 · Duration fitting is a deterministic greedy fill, verified over the whole grid
Main block first, further exercises join in priority order with ≥ 2 sets, then sets grow toward the design and the maximum, and finally rest times are nudged within 0.6–1.5×. A property test covers 6 rhythms × 4 lengths × 5 levels × 5 equipment sets × 7 weekdays × 3 variants: every normal session lands within ±15 % of the chosen length, recovery days 10–20 min, short/light ≈ 10 min.

### D20 · Reductions: lighter week 60 % of sets, return after a break 70 % → 85 %, "feeling off" 70 %, floor 40 %
Return after 7+ days without real training (light/recovery extras do not count) also lowers targets by 10 % — no guilt, no catch-up. "Feeling off" lowers targets by 10 %. Reduced sessions never drive progression, and progression is held the day after a tired / pain / ill recovery day ("busy" does not hold it). No max test is suggested after recent pain, illness, tiredness, a break, or within 3 weeks of the last test.

### D21 · Without a bar or rings: strength days → legs/core, volume days → push
So the two still alternate in every template; the plan carries a `noPullEquipment` flag that TODAY explains. "Short version" stays a 10-minute session built on the push main exercise.

### D22 · A workout is committed the moment the last set is logged; mood and note are edited afterwards
The completion screen shows a workout that is already saved (one atomic write that also clears the active session). Mood and the one-line note update that record. Closing the app on the completion screen loses nothing.

### D23 · Only logged sets are saved; unreached sets are not recorded as skipped work
"Finish now" keeps the sets that were really done and marks the workout `finishedEarly` ("what you did still counts"). Planned-but-unreached sets are counted only to show "4 / 13" on the completion screen — no fake numbers, no penalty.

### D24 · On a planned rest day TODAY offers light mobility first and "Train anyway: {next workout}" as a quiet link
The "early" variant pulls the next scheduled workout forward; the 48 h heavy-pulling guard and all reductions still apply. Planned rest is never shown as missed.

### D25 · Swapping an exercise is allowed only before its first set; "feeling off" only before the first set of the session
Changing the exercise mid-way would mix two exercises in one log entry and corrupt progression. "Feeling off" rebuilds the whole plan, so it is offered only on the pre-start view and can be switched back.

### D26 · The session is persisted after every change (set, rest, pause, timer)
Rest and hold timers are stored as UTC timestamps, so a reload, a killed tab or a locked phone resumes at the correct second. Pausing shifts both. The screen wake lock is requested while the workout screen is open (where supported).
