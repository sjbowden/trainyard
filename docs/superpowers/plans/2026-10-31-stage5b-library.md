# Stage 5b: Player Puzzle Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play the 2,780 best player-made puzzles from trainyard.ca in the app, loaded onto the phone from a file, browsed by featured set or difficulty, with creator credit.

**Architecture:** A dev script turns `local/library-raw.json` (already scraped) into one compact file, `local/trainyard-library.json`, which Scott saves to iCloud Drive. The app reads it through a file picker, checks every puzzle decodes, and keeps it in IndexedDB like the APK puzzles. A pure module groups and sorts the puzzles; three small screens browse and play them through the existing `PuzzleScreen`. Progress uses the existing `Progress` record under `library/<id>` keys.

**Tech Stack:** TypeScript, Preact, idb-keyval, Vitest (node + happy-dom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md` (goal 6; "User-made puzzle library" under Constraints).

## Global Constraints

- The library file and every player puzzle code stay out of git and out of the public site, like the APK content. Tests build their puzzles with the app's own encoder (`encodeBoard`), never with scraped codes.
- "Each entry keeps name, creator, wrenches, likes and solve count, and creator credit is shown in the app."
- "the player loads it onto the phone once (Files app picker)."
- American English. Git identity Scott Bowden <sjbowden@gmail.com>. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before pushing: `npm test` with the APK present, `npm run typecheck`, `npm run e2e`.

## Decisions this plan makes (the spec is silent)

- **File format:** `{ "format": "trainyard-library", "version": 1, "puzzles": LibraryPuzzle[] }`, about 300 KB. A file without that `format` tag is refused with a plain message.
- **Featured first:** the 28 featured puzzles in their four sets, in the site's order: Port Credit, Lorne Park, Cooksville, Erindale (confirm against `https://trainyard.ca/puzzles/featured` once while running Task 1; if the site differs, use the site's order).
- **Difficulty bands** from the wrench counts (counts from the scrape): 1–5 (1,008), 6–10 (457), 11–17 (609), 18–24 (310), 25–30 (396). Exact values would make 28 lopsided groups.
- **Sorting** within a band: Most liked (default) or Most solved, a toggle remembered in Settings (`librarySort`). Featured sets keep the site's order.
- **Long lists** show 100 puzzles, then a "Show more" button adding 100.
- **Next** after a solve goes to the next puzzle in the same list and order; none after the last.
- **Not a city:** no stars, no locks. A list shows "N of M solved", and solved puzzles a check mark.
- A puzzle that won't decode is dropped at build time and again at import (the import reports how many were kept).

## Review Focus

1. A library file from an older or newer build, a truncated file, or the APK chosen by mistake: a plain message, and an already-loaded library stays.
2. Loading the library again (a newer file) keeps progress on puzzles still in it.
3. Names and creators with odd characters (quotes, emoji, `<`, very long names) display as text and don't break the layout or routes.
4. A puzzle route for an id that isn't in the library (old link, library not loaded): goes to the library screen, not a blank page.
5. Storage refusing the library (private browsing, full): the puzzles still play this session, with the same notice wording as the APK.

---

### Task 1: The library file format and the build script

**Files:**
- Create: `src/data/library.ts`
- Create: `scripts/build-library.ts`; add `"library:build": "tsx scripts/build-library.ts"` to `package.json` (match how `scrape:library` runs)
- Test: `tests/data/library.test.ts`

**Interfaces:**
- Produces, in `src/data/library.ts`:
  - `interface LibraryPuzzle { id: string; name: string; creator: string; wrenches: number; likes: number; solves: number; featured?: { set: string; order: number }; code: string }`
  - `const FEATURED_SETS: readonly string[]` (the four names in order)
  - `function buildLibraryFile(raw: { puzzles: Record<string, RawPuzzle> }): { text: string; kept: number; dropped: number }` where `RawPuzzle` is the scraper's `LibraryPuzzle` (import the type from `scripts/scrape-library.ts` or restate it here and have the scraper import it, whichever keeps one definition)
  - `function parseLibrary(text: string): { puzzles: LibraryPuzzle[]; dropped: number }`, throwing `LibraryError` (an `Error` subclass, `name = 'LibraryError'`) with message `"That file isn't a Trainyard library."` for anything that isn't valid JSON with `format === 'trainyard-library'` and `version === 1`.

- [ ] **Step 1: Write the failing tests** (`tests/data/library.test.ts`, node project). Make two or three codes with `encodeBoard` from boards built with the editor helpers (`emptyBoard`, `placePiece`); no scraped codes.
  - `buildLibraryFile keeps decodable puzzles with codes and drops the rest`: raw with one good puzzle, one `code: null`, one `code: 'zz!'` → `kept 1, dropped 2`; the parsed text's puzzle equals the good one with `encodedID` removed.
  - `a featured puzzle the feeds didn't list gets wrenches and likes of 0, not null`.
  - `parseLibrary round-trips buildLibraryFile`.
  - `parseLibrary refuses other files`: `'not json'`, `'{}'`, `JSON.stringify({ format: 'trainyard-library', version: 2, puzzles: [] })` each throw `"That file isn't a Trainyard library."`.
  - `parseLibrary drops an entry that won't decode or is missing a field, and counts it`.
- [ ] **Step 2: Run** `npx vitest run tests/data/library.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `src/data/library.ts`. Validation is per entry: string `id`, `name`, `creator`, `code`; finite numbers; `decodeBoard(code)` doesn't throw. The script reads `local/library-raw.json`, writes `local/trainyard-library.json`, prints kept/dropped and the file size.
- [ ] **Step 4: Run** the test file. Expected: PASS. Then `npm run library:build`. Expected: `2780 kept, 0 dropped` (the scrape found all 2,780 decodable) and a file around 300 KB. Confirm the featured set order against the site (one page fetch).
- [ ] **Step 5: Commit** `feat(library): the library file format and its build script`. Check `git status` shows nothing under `local/`.

### Task 2: Keeping the library on the phone, and grouping it

**Files:**
- Modify: `src/app/store.ts` (add `importLibrary`, `loadLibrary`)
- Create: `src/app/library.ts`
- Modify: `src/app/settings.ts` (`librarySort: 'likes' | 'solves'`, default `'likes'`)
- Test: `tests/app/library.test.ts`, additions to `tests/app/store.test.ts`

**Interfaces:**
- Consumes: `LibraryPuzzle`, `parseLibrary`, `LibraryError`, `FEATURED_SETS` from Task 1.
- Produces, in `store.ts`:
  - `importLibrary(file: Blob): Promise<{ puzzles: LibraryPuzzle[]; saved: boolean; dropped: number }>`. Unreadable file → `"Couldn't read the file. Check your connection and try again."`; a `LibraryError` passes through. A failed parse leaves the stored library alone. Stored under `library/v1`.
  - `loadLibrary(): Promise<LibraryPuzzle[] | null>` (null when nothing stored or storage fails).
- Produces, in `library.ts`:
  - `type LibraryGroup = { kind: 'featured'; set: string } | { kind: 'band'; band: number }` (band index 0–4)
  - `const BANDS: { from: number; to: number }[]` = 1–5, 6–10, 11–17, 18–24, 25–30
  - `libraryKey(id: string): string` → `library/${id}`
  - `groupPuzzles(lib: LibraryPuzzle[], g: LibraryGroup, sort: 'likes' | 'solves'): LibraryPuzzle[]` (featured: by `order`, ignoring `sort`; band: by `sort` descending, ties by name)
  - `groupSummaries(lib, progress): { group: LibraryGroup; label: string; count: number; solved: number }[]`: the featured sets that have puzzles, then the bands that have puzzles. Labels: the set name; `"1–5 wrenches"` etc.
  - `nextInGroup(lib, g, sort, id): LibraryPuzzle | undefined`
  - `groupSlug(g): string` / `parseGroupSlug(s: string): LibraryGroup | null` for routes (`f-<set>`, `w-<band>`)

- [ ] **Step 1: Write the failing tests.** `tests/app/library.test.ts` uses a small hand-made library (codes from `encodeBoard`):
  - `bands cover 1 to 30 with no gaps or overlaps`
  - `a band sorts by likes or by solves, most first, ties by name`
  - `a featured set keeps the site's order whatever the sort`
  - `summaries list featured sets in order, then non-empty bands, with solved counts from progress`
  - `nextInGroup follows the list order and stops at the end`
  - `group slugs round-trip, including a set name with spaces, and nonsense parses to null`

  `tests/app/store.test.ts` additions:
  - `importLibrary keeps the library and loadLibrary returns it`
  - `importLibrary refuses a file that isn't a library and keeps the one already stored`
  - `importLibrary still returns the puzzles when the phone won't save them` (follow the existing "won't save" test's way of making storage fail)
- [ ] **Step 2: Run** `npx vitest run tests/app/library.test.ts tests/app/store.test.ts`. Expected: FAIL on the missing exports.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(library): keep the library on the phone and group it by set and difficulty`.

### Task 3: Browsing and playing the library

**Files:**
- Modify: `src/app/router.ts` (routes below)
- Create: `src/app/screens/LibraryScreen.tsx`, `src/app/screens/LibraryListScreen.tsx`
- Modify: `src/app/screens/HomeScreen.tsx` (a "Player puzzles" tile under "My puzzles", hint `"From trainyard.ca"`)
- Modify: `src/app/App.tsx` (load the library at startup with the other data; wire routes; play through `PuzzleScreen`)
- Modify: `src/app/styles.css` as needed
- Test: `tests/app/router.test.ts`, `tests/app/screens.test.tsx`, `e2e/library.spec.ts`; `README.md`

**Interfaces:**
- Consumes: Task 2's store and `library.ts` exports.
- Routes: `{ name: 'library' }` ↔ `#/library`; `{ name: 'libraryList'; group: string }` ↔ `#/library/<groupSlug>`; `{ name: 'libraryPuzzle'; group: string; id: string }` ↔ `#/library/<groupSlug>/<id>`.
- `LibraryScreen({ library, progress, onLoaded })`: with no library, a short paragraph (`"Load the library file made from trainyard.ca's best player puzzles. It stays on this phone."`) and a `Choose library file` picker (`accept=".json,application/json"`); with one, the group tiles from `groupSummaries` (label, `"N of M solved"`), and at the bottom a smaller "Load a newer library file" picker. Import errors show in place, as on the APK screen.
- `LibraryListScreen({ library, group, progress, sort, onSort })`: header with the group label; for bands, a two-way toggle Most liked / Most solved; rows show name, `by <creator>`, wrenches, likes or solves (whichever is the sort), and ✓ when solved; 100 rows then `Show more`.
- Playing: `PuzzleScreen` with `title={name}`, `stars={0}`, saved solution from `libraryKey(id)`, `onNext` from `nextInGroup`, Back to the list, and as children a credit line `by <creator> · <n> wrenches · <likes> likes`.

- [ ] **Step 1: Write the failing tests.**
  - router: `library routes round-trip, including a set name with spaces and an id`; `#/library/nonsense` parses to the library route.
  - screens: `the library screen asks for the file when none is loaded`; `with a library it lists the featured sets, then the bands, with solved counts`; `a band list sorts by the chosen order and shows 100 rows, then more`; `a name with markup shows as text` (`<b>x</b>` is in the text, no `b` element).
  - e2e `e2e/library.spec.ts` (no APK needed): write a small library file in the test's temp dir from codes made in the browser test helper or a fixture board built with `encodeBoard` in a Node step; load it from Home → Player puzzles; open a band; play the first puzzle to a win (a one-straight board: outlet left, goal right, draw across); Back shows ✓ and "1 of N solved"; reload the page and the library is still there.
- [ ] **Step 2: Run** `npx vitest run tests/app/router.test.ts tests/app/screens.test.tsx` and `npx playwright test e2e/library.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** An unknown group or id falls back to the library screen (Review Focus 4). When `importLibrary` returns `saved: false`, show `"This phone wouldn't save the library, so you'll need to load it again next time."`.
- [ ] **Step 4: Run** both commands, then the full `npm test`, `npm run typecheck`, `npm run e2e`. Expected: all pass.
- [ ] **Step 5: README:** a "Player puzzle library" section: run `npm run library:build`, copy `local/trainyard-library.json` to iCloud Drive, then Home → Player puzzles → Choose library file. Add `local/trainyard-library.json` to CLAUDE.md's never-commit line next to `library-raw.json`.
- [ ] **Step 6: Commit** `feat(library): browse and play the player puzzle library`.
