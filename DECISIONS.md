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
*v2: extended by D55 / D58 — weekly slots plus a persisted session rotation replace the per-weekday templates; the 5-day layout changed.*

### D18 · Strict-pull-up targets stay at least 2 reps below the working max
Max-based slots start at a fraction of the max (60 % strength, 50 % volume) and double progression may raise them only up to `max − 2` (2–3 reps in reserve, guardrail 4). Above that, progress comes from the max test (suggested every 4 weeks, never forced), an honest self-update or logging more reps than planned.
*v2: superseded by D62 — the reserve now applies to every strict set on every day, checked after the day's cuts.*

### D19 · Duration fitting is a deterministic greedy fill, verified over the whole grid
Main block first, further exercises join in priority order with ≥ 2 sets, then sets grow toward the design and the maximum, and finally rest times are nudged within 0.6–1.5×. A property test covers 6 rhythms × 4 lengths × 5 levels × 5 equipment sets × 7 weekdays × 3 variants: every normal session lands within ±15 % of the chosen length, recovery days 10–20 min, short/light ≈ 10 min.

### D20 · Reductions: lighter week 60 % of sets, return after a break 70 % → 85 %, "feeling off" 70 %, floor 40 %
Return after 7+ days without real training (light/recovery extras do not count) also lowers targets by 10 % — no guilt, no catch-up. "Feeling off" lowers targets by 10 %. Reduced sessions never drive progression, and progression is held the day after a tired / pain / ill recovery day ("busy" does not hold it). No max test is suggested after recent pain, illness, tiredness, a break, or within 3 weeks of the last test.
*v2: for strict pull-ups the cut target must also stay inside the lowered reserve (D62: cap, not stack).*

### D21 · Without a bar or rings: strength days → legs/core, volume days → push
So the two still alternate in every template; the plan carries a `noPullEquipment` flag that TODAY explains. "Short version" stays a 10-minute session built on the push main exercise.

### D22 · A workout is committed the moment the last set is logged; mood and note are edited afterwards
The completion screen shows a workout that is already saved (one atomic write that also clears the active session). Mood and the one-line note update that record. Closing the app on the completion screen loses nothing.

### D23 · Only logged sets are saved; unreached sets are not recorded as skipped work
"Finish now" keeps the sets that were really done and marks the workout `finishedEarly` ("what you did still counts"). Planned-but-unreached sets are counted only to show "4 / 13" on the completion screen — no fake numbers, no penalty.

### D24 · On a planned rest day TODAY offers light mobility first and "Train anyway: {next workout}" as a quiet link
The "early" variant pulls the next scheduled workout forward; the 48 h heavy-pulling guard and all reductions still apply. Planned rest is never shown as missed.
*v2: an early session counts for the week; once the week's training sessions are done, the remaining training slots are rest days (D57).*

### D25 · Swapping an exercise is allowed only before its first set; "feeling off" only before the first set of the session
Changing the exercise mid-way would mix two exercises in one log entry and corrupt progression. "Feeling off" rebuilds the whole plan, so it is offered only on the pre-start view and can be switched back.

### D26 · The session is persisted after every change (set, rest, pause, timer)
Rest and hold timers are stored as UTC timestamps, so a reload, a killed tab or a locked phone resumes at the correct second. Pausing shifts both. The screen wake lock is requested while the workout screen is open (where supported).

### D27 · Pull-up max chart = best strict set per week, on a true time axis
Section 9 defines the max as the best strict single set in the period; a week is the period. Points come only from workouts (strict-pullup sets and max tests), so tapping a point can open the workout; self-reports are not drawn. Gaps between weeks stay visible (x is time, not index). Fewer than two points → a written empty state. Interaction is one slider-like control (tap/drag to the nearest week, arrow keys, Home/End) instead of dozens of tiny targets.

### D28 · Weekly rhythm counts sessions, not weekdays
Planned = scheduled training days of that week (optional recovery-mobility days and planned rest excluded). Done = days with a real training session — a session brought forward to a rest day counts. A planned day the user marked "rest today" counts toward the plan ("on plan" = done + recovery ≥ planned). Light extras never count. The current week is shown but not judged.
*v2: superseded by D54 / D59 — on plan = training sessions done ≥ planned training sessions; a chosen rest day no longer counts as done (its session waits for the next training day), recovery is shown separately.*

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

## v2 — scheduler and beginner safety

### D54 · "Days per week" means active days; training sessions are the weekly target
The setting counts every active day, recovery days included: 2 → 2 training sessions, 3 → 3, 4 → 4, 5 → 4 + 1 recovery day, 6 → 5 + 1, 7 → 5 + 2 (`weekTargets`). Setup and YOU show the split while choosing ("4 training sessions + 1 recovery day"). The state keeps the numbers apart — `activeDaysPerWeek`, `plannedTrainingSessionsPerWeek`, `completedTrainingSessions`, `completedRecoverySessions` — and weekly targets, "on plan" and the rhythm milestone count training sessions only. Recovery sessions are shown ("recovery 1 of 1") but never required; chosen rest days are shown ("rest chosen: 1") and never count as done. Rejected: counting recovery days as training (a "7-day" week could be on plan with five sessions missing); hiding the split (in v1 "5 days" silently meant 4 sessions).

### D55 · The scheduler is an explicit state machine
The calendar (`WEEK_SLOTS`) says what kind a day is — training, recovery or rest; the rotation (`ROTATIONS`, `trainingRotationIndex`) says which session the next training slot gets. Three pure transitions run day by day from the program start (`rotation.ts`): **enter** (new week → weekly counters and `scheduleCursor` back to 0; rhythm changed → pending session remapped, D58; this week's training target recomputed), **plan** (training slot → the pending session, or rest once the week's training is done; recovery slot → recovery; rest slot → rest), **close** (a real training session → rotation + 1, once per day, and it counts for the week; a recovery session counts as recovery only; rest or nothing → the pending session waits). Every active slot advances `scheduleCursor`, so a recovery slot can never hold the schedule up. Tested with explicit transition tables for 2–7 days (follow, skip, chosen rest, recovery done or skipped, early session, recovery-only weeks) and 26-week random histories (pending = sessions trained mod rotation length, week cap, every rotation completes, no pull after pull). Rejected: deriving the session from the weekday (v1) — a missed or rested Monday lost PULL · STRENGTH for that week.

### D56 · The rotation is stored as a sealed checkpoint; the history stays the source of truth
The state at the start of the first open day is kept in `kv.rotation` (schema v3) and refreshed whenever history, profile or the date changes. It carries a digest of everything it depends on (rules version, start date, rhythm log up to its date, the facts of every earlier program day) plus its own fields. The scheduler resumes from it only while the digest matches; otherwise it recomputes from the start — with the same result (tested: resume = recompute, 8 kinds of stale or damaged checkpoints ignored, reload determinism). An unfinished session keeps its start day open. Export carries the checkpoint and import validates it; merge keeps this device's (re-checked against the merged history), replace takes the file's; v1 / v2 databases and files migrate with `rotation: null` (recomputed). Rejected: the stored state as the truth (one bad write would shift every future session); not storing it at all.

### D57 · A week holds at most its planned training sessions; early sessions count
Once `completedTrainingSessions` reaches `plannedTrainingSessionsPerWeek`, the week's remaining training slots are rest days ("This week's training is done. Recovery is part of training."). "Train anyway" brings the pending session forward and counts like any session, so a week trained early ends early; the 48 h heavy-pulling guard still turns a second strength session into volume. A new week starts from 0: last week's missed sessions are not owed, only the pending session type carries over. Rejected: catching up missed sessions (overload, guilt); letting a week exceed its target on its own.

### D58 · Layouts, alternation, mid-week start, rhythm changes
Slots Mon → Sun (T training, R recovery): 2 `T··T···` · 3 `T·T·T··` · 4 `TT·TT··` · 5 `TT·TTR·` · 6 `TTTTRT·` · 7 `TTTTRTR`. Rotations (P strength, V volume, U push, L legs + core): 2 `P V` · 3 `P U V` · 4–5 `P U V L` · 6 `P U L V U` · 7 `P U L V L`. Each week holds exactly one rotation cycle, so following the plan repeats the same week (tested for 12 weeks per rhythm); one PULL · STRENGTH per cycle; from 4 days on no pull session follows another, also when sessions move and across the wrap. The 5-day layout changed from v1 `P U L · V R ·` to `P U · V L R ·` so that its rotation alternates. A program that starts mid-week is anchored to the weekday (its first days match the full week from that day on). A rhythm change applies from today (D29): the pending session keeps its place if the new rotation has it and it does not put a pull after a pull; otherwise the new rotation continues after the session just done. Switching back and forth on the same day leaves the schedule exactly as it was. Rejected: restarting at PULL · STRENGTH on every change (two strength days in a row); weekday picking (still in IDEAS.md).

### D59 · Recovery slots and chosen rest
A recovery slot is its own session (RECOVERY · MOBILITY, 10–20 min) with START and no "Short version" — it already is the light day. Doing it counts as recovery and moves the schedule on, never the training rotation or progression; skipping it costs nothing. "Rest today instead" on a training day records a chosen rest day: the pending session waits for the next training slot and TODAY says so ("Tomorrow: Pull · Strength" / "Next: Pull · Strength, Thursday"); the week strip shows recovery, not "not trained"; "Train after all" undoes it. Rejected: v1's behaviour, where the rest day counted toward the plan while that day's session was lost.

### D60 · Projection: past days are facts, later days follow the plan
Days before today use what really happened; today uses its facts once there are any; from there on the plan is assumed to be followed. That is how "Tomorrow", the week strip and the rest of the week are shown. Projected days are never stored or counted. Rejected: projecting "nothing happens" (every future slot would show the same pending session).

### D61 · Beginners get no automatic negatives
A negative starts at the top of the bar, so it is planned only with safe top access — a stable box or step (new equipment option) plus a bar or rings — and only once a controlled descent is likely: level 1+, or at level 0 a 30 s hang with 10 scapular pull-ups, 8 band-assisted reps, or negatives already logged. Until then level 0 trains Australian rows, scapular pull-ups and active / dead hangs; with a box also feet-supported hangs and feet-assisted pull-ups; plus core. Negatives stay at ≤ 5 slow reps with "never jump into a negative" in the cues, and the swap list does not offer them to a level-0 plan. Verified over the whole configuration grid and in 26-week simulations (bar only: never a negative; bar + box: only after the readiness rule, ≤ 5 reps). Rejected: negatives as the default first step (common advice, but jumping to the top and dropping uncontrolled is the riskiest thing a true beginner can do alone).

### D62 · Strict pull-ups always keep reps in reserve
Every strict-family working set is planned at 1 … max − 2 (2–3 reps in reserve). The check uses the target actually shown — after the "returning" / "feeling off" cuts — against a strict max lowered by 1 on those days; the cut and the cap do not stack (max 5, feeling off → 2 reps). With a max of 1–2 no strict working sets at all, no singles to failure: band-assisted or feet-assisted pull-ups, negatives (when D61 allows) or rows lead; bar-only sessions are filled with hangs and scapular work. Harder-variation steps and strict-to-strict swaps keep the planned target inside the reserve. A max test stays optional and separate (suggested every 4 weeks, never forced, D20); its warm-up uses strict singles only when they keep the reserve (max 3+), otherwise scapular pull-ups, so the test is the day's only near-max effort. Rejected: strict singles as practice at max 1–2 (each one is a max effort).

### D63 · Progression consistency review, enforced by one rule set
Every path that sets a target or variation (max-based slots, double progression, harder / easier steps, swaps, lighter week, return after a break, feeling off, max tests) was re-checked against the guardrails. `safety.test.ts` checks every generated workout with one rule set — strict working sets 1 … max − 2 (− 1 more on weaker days), negatives only as D61 allows and ≤ 5 reps, strict warm-ups inside the reserve, test sets only in max tests, a main exercise in every pull session with a bar or rings — over the whole grid (3 rhythms × 8 equipment sets × 11 maxes from 0 to 20 × 8 session types × normal / lighter week / returning / feeling off / both) and over 26-week (level 0) and 20-week (max 1–9, max tests taken, every equipment set) simulations. Recovery sessions and chosen rest days never drive progression; the max still comes only from strict pull-ups (D16). Known limitation: with only a bar, a level 2+ user cannot swap strict pull-ups for an assisted variation (none fits the equipment). Rejected: spot checks of a few profiles — what this review fixed (the reserve after the day's cuts, strict swaps, bar-only sessions too short) only showed up in combinations.
