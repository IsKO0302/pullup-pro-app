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

### D27 · Pull-up max chart = best strict set per week, on a true time axis
Section 9 defines the max as the best strict single set in the period; a week is the period. Points come only from workouts (strict-pullup sets and max tests), so tapping a point can open the workout; self-reports are not drawn. Gaps between weeks stay visible (x is time, not index). Fewer than two points → a written empty state. Interaction is one slider-like control (tap/drag to the nearest week, arrow keys, Home/End) instead of dozens of tiny targets.

### D28 · Weekly rhythm counts sessions, not weekdays
Planned = scheduled training days of that week (optional recovery-mobility days and planned rest excluded). Done = days with a real training session — a session brought forward to a rest day counts. A planned day the user marked "rest today" counts toward the plan ("on plan" = done + recovery ≥ planned). Light extras never count. The current week is shown but not judged.

### D29 · Past weeks keep the rhythm that applied then (`profile.rhythmChanges`)
Changing days per week records `{ from, daysPerWeek }`; the week strip, the rhythm grid and the "4 weeks of rhythm" milestone read the value that applied on each date, so raising the rhythm never turns old weeks into "missed". Optional field → no schema migration needed; absent = the current value everywhere.

### D30 · Milestones are recomputed from data, never stored
12 fixed milestones in a fixed order, each with the local date it was first reached or its plain criterion. Recomputing from history means deleting or importing workouts can never leave a stale badge. "New personal record" uses the same rule as the completion screen (tested against it over a simulated half year).

### D31 · Demo data only through a guarded dev/e2e hook
`window.__pullupTest.seedDemo()` exists only in dev/e2e builds on a non-default database, refuses `pullup-pro` itself (unit-tested), and writes through the same atomic `replaceAll` that import will use.

### D32 · Thought of the day: short format only, pinned per local date
`hash(YYYY-MM-DD + fixed salt)` picks among the 60 short thoughts not shown in the previous 30 days; the pick is stored in `thoughtDays` the first time it is shown, so it stays identical all local day (reloads, library edits, algorithm changes) and tomorrow's pick can avoid it. It switches at local midnight through `useToday` (timer at 00:00:02 + visibility check). Days the app was not opened have no pin — nothing was shown, so there is nothing to avoid. Reflections are browsable and shareable but not daily: TODAY needs one short line.

### D33 · Rest and completion thoughts are derived, not stored
Rest: a seeded shuffle (per session id) of the 20 short thoughts in sport / discipline / patience / consistency / inner strength, indexed by the rest number → a different thought for every rest and the same one after a reload. Completion: one short thought from growth / success / consistency / patience / inner strength / self-respect, hashed from the workout id → the same when the screen is reopened.

### D34 · Favorites and recently viewed
Favorites: newest first, toggled with one tap (no confirmation — it is undoable). Recently viewed = thoughts opened in the detail view, newest first, de-duplicated, at most 30. Ids that no longer exist in the library are skipped, so content edits can never break a list.

### D35 · Share a thought without a poster
Web Share with text when available; otherwise copy to the clipboard with a quiet "Copied" status. If neither exists the button is not shown. "Make poster" is added in phase 7 together with the real poster (no placeholder). Content uses typographic apostrophes and quotes (’ « » “ ”), enforced by the library test, because the same text goes onto posters.

### D36 · Posters are drawn on a canvas at 2× with a pure, tested layout
The layout (`features/poster/layout.ts`) is pure: it receives a `measure` function, so the same code is unit-tested with a deliberately wide fake font and run in the browser with `ctx.measureText` and the loaded fonts. It picks the largest size at which every word fits the width, the block fits the height and short thoughts stay within 5–6 lines, then balances the lines. Words are never broken except in an emergency path no shipped text reaches (tested over the whole library with the real fonts).

### D37 · Typographic line-break rules per language
A dash stays at the end of the previous line (Russian convention); Russian and English one- and two-letter words travel with the next word ("с другими", "a year"); Turkish enclitics *de / da / mi* stay with the word before ("Ben de."). Short thoughts are upper-cased only in Pure Black, with `toLocaleUpperCase('tr-TR')` for Turkish (i → İ).

### D38 · Completion posters may carry one real result line
From the completion screen the poster can show "DATE · N PULL-UPS" (or reps / minutes when there were no pull-ups), taken from the saved workout — never estimated. A switch removes it; posters opened from THOUGHTS never have it. The only branding is the small "PULLUP PRO" mark.

### D39 · Share an image when the device can, otherwise save it
The button says "Share image" only if `navigator.canShare({ files })` is true, otherwise "Save image" (download). A cancelled share is silent; any other share error falls back to saving the file. No button is shown that cannot do what it says.

### D40 · One readable export file; facts about this browser are not exported
`pullup-pro-backup-YYYY-MM-DD.json`, 2-space JSON: `format: "pullup-pro-export"`, schema version, app version, `exportedAt` (UTC) + local date + time zone, a summary (workouts, notes, favorites, recovery days) and the data. Storage protection is a property of this browser, not of the person, so it is never exported and always kept on import. The export time is written into the data first (`lastExportAtUtc`), so export → reset → import gives back exactly the same state (e2e-tested).

### D41 · Validate the whole file before writing anything
Import parses, checks format and version, migrates and validates every record (ids, local dates, UTC times, enums, duplicates) in memory; only a fully valid result reaches the database. Harmless gaps get defaults, unknown keys are dropped. Errors are short and say what is wrong ("not a PULLUP PRO file", "made by a newer version", "damaged at workouts[3].sets") and always end with "Your data was not changed." A file from a newer schema is refused rather than guessed. File migrations mirror the database migrations step by step (a test proves migrating a v1 file equals migrating a v1 database).

### D42 · Merge is the default, and this device wins
Merge adds what is missing (workouts by id, recovery / thought days by local date, favorites, max entries) and never overwrites: the same workout or day already on this device keeps its version (edited notes, today's pinned thought). Profile and settings come from the file only when this device has no finished profile. "Recently viewed" is the union, newest first, capped at 30. Replace gives the device exactly the file's data. On an empty device there is one button, "Restore this data". Merging the same file twice changes nothing (tested).

### D43 · Automatic snapshots in the same transaction
Import, reset and snapshot-restore all go through `applyWithSnapshot`: ONE IndexedDB readwrite transaction reads the current data, stores it as a snapshot, prunes to the newest 3 and writes the new data — any failure aborts everything, so there is never a change without its safety copy or a copy without the change. Nothing is copied when there is nothing to protect (fresh install). Restoring a snapshot runs it through the same validation and migration as a file, so copies taken under an older schema stay restorable; the state being replaced is snapshotted too, so a restore can itself be undone.

### D44 · Reset: two steps, an export offer, and undo on the first screen
Reset is the only destructive action with two confirmations (the first sheet offers "Export first"). It returns to a first launch, keeping only the storage-protection fact. Because the profile is gone, the language screen offers "Undo the reset from {date}" (when the newest snapshot is a pre-reset copy) and "Restore from a backup file" — no hunting for a settings screen that no longer exists.

### D45 · Storage protection is requested once, after the first workout
Browsers may delete site data under storage pressure. `navigator.storage.persist()` is requested after the first completed workout — the moment there is something worth protecting — instead of on first launch. The answer is stored; YOU shows the live status (protected / not protected with "Ask again" / not supported) and recommends installing the app and exporting now and then.

### D46 · Backup reminder: every 30 days, TODAY and YOU only
Due when there is at least one workout and 30 days have passed since the latest of: last export (or the first workout if never exported) and the last "Later". Shown as one calm banner (Export / Later) on TODAY below the week strip and in YOU → Data; never during a workout, never as a notification.

### D47 · Updates never interrupt a workout
`registerType: 'prompt'`: a new service worker waits. "Update ready · Restart now" appears on TODAY and YOU only when no session is active; with an open session nothing appears on TODAY and YOU explains that the update waits until the workout is finished. `applyUpdate` itself refuses while a session exists (belt and braces). The installed app checks for a new version hourly while online.

### D48 · Settings save instantly; YOU is code-split
Every YOU control saves on change (the name on blur / Enter, with a quiet "Saved") — no Save buttons, no confirmation dialogs for reversible changes. Days-per-week changes go through the rhythm history (D29), so past weeks keep their labels. "Save new max" adds a self-reported entry for strict pull-ups; the value shown is the current working max (latest setup answer / self-report / max test, raised by any later strict set, see `domain/level.ts`) with its source. YOU, import and the snapshot sheets are lazy chunks, keeping the initial JS well under budget.

### D49 · QA is automated, not eyeballed
`qa.spec.ts` walks 22 real states at five widths, at 130 % text and in RU / TR, and fails on things a person would notice: sideways scrolling, elements outside the screen or cut off, touch targets under 48 px, axe-core WCAG 2.2 AA / best-practice violations, English words on a RU / TR screen. Deliberate exceptions are structural, not per-element: horizontal scrollers (topic chips), visually hidden text, ellipsis. 130 % text is simulated with `html { font-size: 130% }`, which works because every size is in rem. The mixed-language detector compares visible words with everything the target language's texts contain (UI, exercises, thoughts, Intl month / weekday names), so no allow-list has to be maintained.

### D50 · Single-choice chip groups follow the ARIA radio pattern
One Tab stop (the selected chip); arrow keys, Home and End move and select. Multi-select chips (equipment, goals) and the mood row stay toggle buttons with `aria-pressed` — each is its own Tab stop, Space toggles, the mood can be cleared again.

### D51 · Accessible names start with the visible label
Buttons whose visible text is an abbreviation keep it at the start of their name ("−15 s (15 seconds less rest)"), so voice control ("tap minus 15 s") and screen readers agree (WCAG 2.5.3). Every screen has a level-one heading (on the rest screen "Rest", on a thought its topic) and all content sits in landmarks (the workout screen is one `main`).

### D52 · Russian stays gender-neutral for the user; Isa's welcome stays verbatim
UI and thoughts never address the user in a gendered past tense ("Без сил", not "Устал"; "Недавно была отмечена боль", not "ты отметил"). The welcome text is Isa's own words from the specification and is not edited. Muscle lists are joined with ", " in every language (`Intl.ListFormat`'s unit style drops the commas in RU / TR).

### D53 · Lighthouse runs locally, not as a dependency
Lighthouse is ~100 MB of tooling for an occasional check, so it is run with `npx` against `npm run preview` (README). In containers Chrome needs `--disable-dev-shm-usage` (a small `/dev/shm` otherwise yields "NO_FCP"). Lighthouse 12+ has no PWA category; installability is covered by Chrome's own `Page.getInstallabilityErrors` in `pwa.spec.ts`.
