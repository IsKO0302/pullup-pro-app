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
