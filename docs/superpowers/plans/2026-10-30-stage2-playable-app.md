# Stage 2: Playable Phone App, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scott can open the app on his iPhone from the home screen, load his APK once, and play all 233 original puzzles. That means drawing track with a finger, running trains with the Stage 1 engine, and earning stars that unlock cities. It works offline.

**Architecture:** A static Vite app, deployed to GitHub Pages at `https://sjbowden.github.io/trainyard/`.
- **Pure, unit-tested modules** carry all the logic: track editing, progress, geometry, animation timing, and the APK and tutorial parsing.
- **A thin Preact layer** draws the screens.
- **The board** is a `<canvas>` drawn through a `Theme` interface. Stage 5 adds the Original theme behind the same interface.
- **Storage:** IndexedDB holds what the APK supplied and the player's progress.

**Tech Stack:** TypeScript, Vite, Preact, `vite-plugin-pwa` (manifest plus Workbox service worker), `idb-keyval`, the Web Audio API (synthesized sounds for the default theme), Vitest with `fake-indexeddb` and `happy-dom` for unit tests, and Playwright (WebKit, iPhone emulation) for the end-to-end smoke test.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md`. Stage 1 plan: `docs/superpowers/plans/2026-10-29-stage1-engine.md`. Rules: `docs/rules.md`.

**Stage 2 of 5.** Not in this stage: the editor and share links (Stage 3), the generator (Stage 4), the user-puzzle library and the Original art and sounds (Stage 5). Home-screen tiles for those features are not shown yet.

## Global Constraints

- Everything in Stage 1's Global Constraints still applies. In particular, the deployed site must contain **no** APK data, original puzzle codes, art or sound. Those reach the phone only from the APK the player opens.
- **iPhone first.** Portrait at 375–430 CSS px wide is the design target. The board fills the width with a 16 px gutter. Touch targets are at least 44 px. Respect the safe-area insets (`env(safe-area-inset-*)`), and there is no horizontal scroll.
- **American English** in all UI text.
- Base path `/trainyard/` (GitHub Pages project site).
- **Rule accuracy:** the app never reimplements rules. All run logic goes through `createRun` from `src/engine`.
- **Drawing must feel like the original.** Use the original's `TrackDrawer` behavior as Task 5 states it. This is the spec's "clumsy drawing" anti-goal.

## Review Focus

1. **A fast swipe that skips cells** between pointer events. The skipped cells must get track as if the finger passed through them, never a gap. (Task 5: `drawPath interpolates skipped cells`.)
2. **Opening the app with no APK loaded, or with an IndexedDB that fails** (private browsing, storage cleared by iOS). The app shows the Load APK screen and never a blank page or uncaught error. (Task 3: `loadCollections returns null when storage throws`.)
3. **A run that crashes or loops forever.** The animation stops when the run ends (`Run.ended`), and a looping run stops at the half-step cap with a clear "Stopped" message. It must not hang the page. (Task 1 tests. Task 7: `runs stop at the cap`.)
4. **Editing while a run is playing.** Drawing, erasing and switch taps are ignored until Stop, and Stop restores the drawn board exactly. (Task 7: `edits are locked while running`.)
5. **Choosing a file that isn't a Trainyard APK.** It shows a readable error and keeps any previously loaded data. (Task 3: `importApk rejects a non-APK and keeps existing data`.)

---

### Task 1: Engine additions the app needs

These are Stage 1's deferred minors, which Stage 2 depends on.

**Files:**
- Modify: `src/engine/sim.ts`, `docs/rules.md`
- Test: `tests/engine/sim.test.ts`

**Interfaces:**
- Produces:
  - `Run.ended: boolean`: true once the run is over (won, crashed and finished, or stalled).
  - `simulate()` returns `outcome: 'won' | 'crashed' | 'stalled' | 'timeout'`, where `'timeout'` means it hit `maxHalfSteps` with the run still going.
  - `Run.trainsBefore: readonly TrainState[]`: a snapshot of the trains at the start of the last half-step (live and dead). The renderer needs both ends of each move to animate it.

- [ ] **Step 1:** Write the failing tests:
  - `ended is false while running and true after a win`;
  - `a crashed run keeps stepping until it ends` (`outcome === 'crashed'` while `ended === false`, then both are set);
  - `simulate reports timeout for a looping run` (one outlet into a closed loop of track with an unreachable goal, `maxHalfSteps` 50 → `'timeout'`);
  - `trainsBefore holds each train's previous cell`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/sim.test.ts`. Expect the 4 new tests to fail.
- [ ] **Step 3:** Implement: expose the private `over` flag as `ended`, add the snapshot taken at the start of `halfStep()`, and return `'timeout'` from `simulate`.
- [ ] **Step 4:** Fix `docs/rules.md`:
  - "Where we differ": the viewer wraps left/right edges into the adjacent row, and sends top/bottom edges back into the train's own cell.
  - Soften the opening line to "match the original game's rules, except leaving the board".
- [ ] **Step 5:** Run `npm test` and expect it all green. Run `npm run typecheck` and expect it clean. Commit `feat(engine): ended flag, timeout outcome, previous-train snapshot`.

### Task 2: App scaffold, PWA and deploy pipeline

**Files:**
- Create: `index.html`, `vite.config.ts`, `src/app/main.tsx`, `src/app/App.tsx`, `src/app/styles.css`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (our own simple icon: a green track curve on a dark tile, drawn by a script `scripts/make-icons.ts` with `@napi-rs/canvas` as a dev dependency), `.github/workflows/pages.yml`
- Modify: `package.json` (scripts `dev`, `build`, `preview`), `tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: preact`, `lib` adds `DOM`), `.github/workflows/ci.yml` (bump `actions/checkout` and `actions/setup-node` to v5, add `npm run build`), `vitest.config.ts` (`environment: 'happy-dom'` for `tests/app/**`)
- Test: `tests/app/smoke.test.tsx`

**Interfaces:**
- Produces:
  - `npm run dev`, `npm run build` (output `dist/`), `npm run preview`.
  - Vite `base: '/trainyard/'`.
  - Manifest: `name` "Trainyard", `display: 'standalone'`, `orientation: 'portrait'`, `background_color`/`theme_color` `#0b1416`. The service worker precaches the app shell, including `sql-wasm.wasm`, which is imported with `?url`.

- [ ] **Step 1:** Write a failing test, `App renders the title`: render `<App />` with `@testing-library/preact` and expect the text "Trainyard".
- [ ] **Step 2:** Install `vite preact @preact/preset-vite vite-plugin-pwa idb-keyval`, plus the dev tools `@testing-library/preact happy-dom fake-indexeddb @napi-rs/canvas`. Write `App.tsx` as a placeholder screen with the title. Run the test and expect PASS.
- [ ] **Step 3:** Set up the PWA in `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` `black-translucent`, and the apple-touch-icon. Set `body { background: #0b1416; overscroll-behavior: none; touch-action: manipulation; }`.
- [ ] **Step 4:** Run `npm run build`, then `npm run preview`. Load `http://localhost:4173/trainyard/` with Playwright (`npx playwright install webkit` once), take a screenshot, and check that the title shows and that a service worker registered (`navigator.serviceWorker.getRegistrations()` has length 1).
- [ ] **Step 5:** Write the `pages.yml` workflow. On push to main it runs `npm ci`, `npm run build`, `actions/upload-pages-artifact` (path `dist`) and `actions/deploy-pages`, with permissions `pages: write` and `id-token: write`.
- [ ] **Step 6:** Commit `feat(app): scaffold installable web app and Pages deploy`.
- [ ] **Step 7:** **Ask Scott before this step** (outward action). Enable Pages with source "GitHub Actions": `GH_TOKEN=$(gh auth token --user sjbowden) gh api -X POST repos/sjbowden/trainyard/pages -f build_type=workflow`. Push using the recipe in memory `push-with-personal-account`. Verify that `curl -s -o /dev/null -w '%{http_code}' https://sjbowden.github.io/trainyard/` returns 200.

### Task 3: Storage and APK import in the browser

**Files:**
- Create: `src/app/store.ts`
- Test: `tests/app/store.test.ts` (uses `fake-indexeddb/auto`)

**Interfaces:**
- Consumes: `readApk(bytes, sqlConfig)` and `Collection` from `src/data/apk.ts`.
- Produces:
  ```ts
  export async function importApk(file: Blob, wasmUrl: string): Promise<Collection[]>; // reads, validates, then saves; throws Error with a user-readable message
  export async function loadCollections(): Promise<Collection[] | null>;   // null when nothing is stored or storage fails
  export async function loadProgress(): Promise<Progress>;                 // empty progress on failure
  export async function saveProgress(p: Progress): Promise<void>;
  ```
  `Progress` comes from Task 4.

- [ ] **Step 1:** Write the failing tests:
  - `importApk saves collections that loadCollections returns`: needs a real APK, `skipIf` none is present. It runs `readApk` with Node's wasm path. To make that possible, `importApk` takes the `wasmUrl` and passes `{ locateFile: () => wasmUrl }`.
  - `importApk rejects a non-APK and keeps existing data`.
  - `loadCollections returns null when storage throws` (stub `indexedDB.open` to throw).
  - `progress round-trips`.
- [ ] **Step 2:** Run `npx vitest run tests/app/store.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement with `idb-keyval` keys `collections/v1` and `progress/v1`. Wrap every call in try/catch. `importApk` validates by calling `readApk` before overwriting anything, and maps any failure to `Error("That file isn't a Trainyard APK.")`.
- [ ] **Step 4:** Run the tests and expect PASS. Commit `feat(app): store APK puzzles and progress on the device`.

### Task 4: Progress, stars and unlocks

**Files:**
- Create: `src/app/progress.ts`
- Test: `tests/app/progress.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LevelProgress { solved: boolean; solution: string /* solution half only */ }
  export interface Progress { levels: Record<string /* `${collectionId}/${slug}` */, LevelProgress> }
  export const emptyProgress: () => Progress;
  export function levelKey(collection: Collection['id'], slug: string): string;
  export function starsEarned(c: Collection, p: Progress): number;   // sum of level.stars over solved levels
  export function isWorldUnlocked(c: Collection, worldSlug: string, p: Progress): boolean; // starsEarned >= world.starsToUnlock
  export function recordAttempt(p: Progress, key: string, solution: string, solved: boolean): Progress; // pure; keeps solved=true once set
  ```
  The two collections keep separate star totals (spec ruling).

- [ ] **Step 1:** Write the failing tests, using a small hand-made `Collection`:
  - `abbotsford is unlocked from the start` (`starsToUnlock` 0);
  - `brampton unlocks at 6 stars`;
  - `stars count each solved level once`;
  - `an unsolved attempt keeps an earlier solve`;
  - `Trainyard and Express stars are separate`.
- [ ] **Step 2:** Run. Expect FAIL. Then implement, run and expect PASS. Commit `feat(app): stars and city unlocks`.

### Task 5: Track editing model

**Files:**
- Create: `src/app/editing.ts`
- Test: `tests/app/editing.test.ts`

**Interfaces:**
- Consumes: `Board`, `Piece`, `Segment`, `Side` from `src/engine`.
- Produces:
  ```ts
  export function drawPath(board: Board, cells: number[]): Board;   // pure; cells = the touched cells in order
  export function eraseCells(board: Board, cells: number[]): Board; // track cells become empty; puzzle pieces untouched
  export function toggleSwitch(board: Board, cell: number): Board;  // flips a switchable track cell; otherwise returns the board unchanged
  export function clearTrack(board: Board): Board;
  export class History { constructor(initial: Board); get current(): Board; push(b: Board): void; undo(): Board; redo(): Board; get canUndo(): boolean; get canRedo(): boolean }
  ```
- **Drawing rule (the original's `TrackDrawer`):**
  1. Walk the touched cells. First insert the cells skipped between non-adjacent consecutive cells, along a straight line, preferring horizontal moves first when the move is diagonal.
  2. For every triple prev → cur → next of mutually adjacent cells with `next !== prev`, where `cur` is empty or track, lay the segment joining cur's side facing prev to its side facing next.
  3. **Laying a segment `s` on a track cell:**
     - if the primary is `s`, the secondary becomes Empty;
     - otherwise the secondary becomes the old primary, and the primary becomes `s`.
  4. On an empty cell it becomes `{track, primary: s, secondary: 0}`.
  5. Puzzle pieces are never changed. A U-turn (next === prev) lays nothing.
- **Switchable** means both segments are non-empty and share a side. That is the same rule as the engine.

- [ ] **Step 1:** Write the failing tests:
  - `draws a straight line through the middle cell`: (1,3)→(2,3)→(3,3) gives LR at (2,3) only.
  - `draws a corner`.
  - `redrawing a different segment makes a switch with the new one on top`.
  - `redrawing the top segment removes the other`.
  - `a third segment pushes out the oldest`.
  - `drawPath interpolates skipped cells` (Review Focus 1): (0,3)→(3,3) as two points gives LR at (1,3) and (2,3).
  - `never changes puzzle pieces`.
  - `a U-turn lays nothing`.
  - `toggleSwitch flips only switchable cells`.
  - `history undo and redo`.
- [ ] **Step 2:** Run `npx vitest run tests/app/editing.test.ts`. Expect FAIL. Implement, run and expect PASS. Commit `feat(app): finger-drawn track editing with the original's rules`.

### Task 6: Board geometry, animation timing, theme and default look

**Files:**
- Create: `src/app/board/geometry.ts`, `src/app/board/animation.ts`, `src/app/theme/theme.ts`, `src/app/theme/default.ts`, `src/app/board/render.ts`
- Test: `tests/app/geometry.test.ts`, `tests/app/animation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // geometry.ts
  export interface Layout { originX: number; originY: number; cell: number; cols: number; rows: number }
  export function fitBoard(widthPx: number, heightPx: number, cols: number, rows: number, gutter?: number /* 16 */): Layout;
  export function cellAt(l: Layout, x: number, y: number): number | null;  // null outside the board
  export function cellCenter(l: Layout, cell: number): { x: number; y: number };
  // animation.ts
  export const HALF_STEP_SECONDS = 0.5;                    // the original's step period at speed 1
  export function speedFromSlider(t: number): number;      // the original's curve: 2 ** (4t) - 1, t in [0,1]; the default slider position gives speed 3
  export function trainPose(prevCell: number, cell: number, entry: Side, exit: Side, progress: number /* 0..1 across a full step */, l: Layout): { x: number; y: number; angle: number };
  // theme.ts
  export interface Theme {
    id: string; name: string;
    drawFloor(ctx: CanvasRenderingContext2D, l: Layout): void;
    drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number, size: number, state: { delivered?: number }): void;
    drawTrain(ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, angle: number, size: number): void;
    drawEffect(ctx: CanvasRenderingContext2D, kind: 'crash' | 'paint' | 'split' | 'deliver', x: number, y: number, size: number, t: number): void;
    playSound(kind: 'draw' | 'erase' | 'switch' | 'paint' | 'split' | 'crash' | 'deliver' | 'win' | 'start', color?: Color): void;
  }
  // render.ts
  export function renderBoard(ctx: CanvasRenderingContext2D, theme: Theme, l: Layout, board: Board, trains: { color: Color; x: number; y: number; angle: number }[]): void;
  ```
- **The default theme** is our own look, drawn with vector shapes on canvas:
  - a dark teal floor with a faint grid;
  - track as two rails, with the inactive switch segment drawn dimmer;
  - an outlet as a rounded square with a "+" and its queued train colors as small dots;
  - a goal as a rounded square with a circle, its entry sides marked by a white notch, and its needed colors as dots that fill when delivered;
  - a painter as a stripe of its color, a splitter as a diamond, and a rock as a gray boulder;
  - a train as a short rounded rectangle in its color, with a darker cab end.

  Colors use the engine's seven colors, tuned for contrast on the dark floor. Sounds are short Web Audio synth blips (the `AudioContext` is created on the first user tap, as iOS requires).

- [ ] **Step 1:** Write the failing tests:
  - `fitBoard fills a 390px-wide screen with a 16px gutter` (cell = (390−32)/7);
  - `cellAt maps points to cells and returns null outside`;
  - `trainPose is at the entry edge at 0, the center at 0.5 and the exit edge at 1`;
  - `trainPose follows a quarter-circle on corners`;
  - `speedFromSlider matches the original curve`.
- [ ] **Step 2:** Run. Expect FAIL. Implement, run and expect PASS. The theme and renderer have no unit tests; they are verified visually in Task 7.
- [ ] **Step 3:** Commit `feat(app): board geometry, train animation and default theme`.

### Task 7: Puzzle screen

**Files:**
- Create: `src/app/screens/PuzzleScreen.tsx`, `src/app/board/BoardCanvas.tsx`, `src/app/board/player.ts`
- Test: `tests/app/player.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 4, 5 and 6, plus `createRun` and `decodeBoard`/`encodeBoard`/`splitCode` from `src/engine`.
- Produces:
  ```ts
  // player.ts: drives a run in real time, framework-free
  export const MAX_HALF_STEPS = 4000;
  export class Player {
    constructor(board: Board, onEvents: (ev: HalfStepEvents) => void);
    advance(seconds: number, speed: number): void;   // steps the run on the original's clock
    get progress(): number;                           // 0..1 within the current full step, for trainPose
    get run(): Run;
    get finished(): 'won' | 'crashed' | 'stalled' | 'stopped' | null; // 'stopped' = hit MAX_HALF_STEPS
  }
  // PuzzleScreen props
  { title: string; puzzleCode: string; savedSolution: string; onResult(solution: string, solved: boolean): void; onBack(): void; tutorial?: TutorialStep[] }
  ```
- **The screen, top to bottom:** a back button and the puzzle name; the board canvas; then a tool row with Draw/Erase toggle, Undo, Redo, Clear, and a Start/Stop button that dominates the row; then the speed slider. Tap a cell to toggle a switch, drag to draw (or erase in Erase mode), and pointer capture stays on the canvas.
- **While running,** all edits are ignored. Stop restores the drawn board, because the run works on a copy.
- **On a win:** an overlay saying "Solved!" with the stars, and buttons for Next puzzle and Back to city. The solution is saved through `onResult`.
- **On a crash:** a crash effect at the cell, and a "Crashed" toast. The run animates until `ended`, then waits for Stop.
- **At the cap:** "Stopped: the trains never finished."
- **Saving:** every edit saves the current solution half (debounced 500 ms) through `onResult(solution, false)`, so leaving and returning keeps the drawing.

- [ ] **Step 1:** Write the failing tests:
  - `advance steps the run at two half-steps per second at speed 1`;
  - `Red Line's solution finishes won`;
  - `runs stop at the cap` (Review Focus 3, a looping board);
  - `edits are locked while running`. That test belongs to a small `PuzzleController` in `player.ts`, holding `History` and `Player`, with `draw(cells)`, `start()` and `stop()`. Assert that `draw` during a run leaves `history.current` unchanged and that `stop()` restores it.
- [ ] **Step 2:** Run. Expect FAIL. Implement `player.ts`, run and expect PASS.
- [ ] **Step 3:** Build `BoardCanvas` (a `requestAnimationFrame` loop, devicePixelRatio scaling, pointer events → `cellAt` → controller) and `PuzzleScreen`.
- [ ] **Step 4:** Verify by hand in Playwright WebKit with iPhone 15 emulation, against `npm run dev` with a dev-only route `?dev=redLine` that loads `local/collections.json` through a Vite dev middleware (never in the build). Do these four things:
  1. drag (1,3)→(5,3);
  2. tap Start;
  3. take screenshots mid-run and at the win;
  4. confirm the overlay appears.
  Then save the screenshots to the workspace and look at them.
- [ ] **Step 5:** Commit `feat(app): playable puzzle screen`.

### Task 8: Home, collections, cities and APK loading

**Files:**
- Create: `src/app/screens/HomeScreen.tsx`, `src/app/screens/CityScreen.tsx`, `src/app/screens/LoadApkScreen.tsx`, `src/app/router.ts` (hash routes: `#/`, `#/load`, `#/c/:collection`, `#/c/:collection/:world`, `#/p/:collection/:slug`)
- Modify: `src/app/App.tsx`
- Test: `tests/app/router.test.ts`, `tests/app/screens.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4 and 7.
- **Screens:**
  - **No collections stored:** Home shows only an explanation ("Open your Trainyard APK to load the original puzzles. It stays on this phone.") and a Load APK button. The button opens `<input type="file">`, which shows the Files app on iOS.
  - **Collections stored:** Home shows Trainyard and Express cards with stars earned. A collection screen lists its cities, with bonus cities under a "Bonus" heading. Each city shows its stars, or a lock with the stars it needs. A city screen shows a grid of its puzzles, each with its name, star value and a solved tick.
  - **Settings:** a "Load a different APK" link at the bottom of Home.

- [ ] **Step 1:** Write the failing tests:
  - `parses and builds every route`;
  - `home without collections shows Load APK`;
  - `locked cities show the stars needed`;
  - `solving a puzzle updates its tick and the city's stars`. That one renders with stub data and calls `onResult`.
- [ ] **Step 2:** Run. Expect FAIL. Implement, run and expect PASS.
- [ ] **Step 3:** Commit `feat(app): home, cities and APK loading`.

### Task 9: Tutorials

**Files:**
- Create: `src/data/tutorials.ts`, `src/app/screens/TutorialOverlay.tsx`
- Test: `tests/data/tutorials.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TutorialStep { boxes: string[] /* create_box texts, "[br]" → newline */; board?: string /* yard_reset full= code */ }
  export function parseTutorial(xml: string): TutorialStep[];   // DOMParser in the browser; the test uses happy-dom
  ```
- **Behavior:** a world's tutorials are those with a matching `worldSlug`. They are offered the first time a city is opened, and from a "?" button on its city screen. Each step shows its text boxes over its board (or the previous step's board), with Back/Next.

- [ ] **Step 1:** Write the failing tests. `parseTutorial` on the `welcome` XML (read from `local/collections.json`, `skipIf` absent) gives 5 steps. Step 1's boxes start with "Welcome to TRAINYARD!", and step 2's board is `hh002OjC3GiaC00`. Also test a hand-written XML snippet, which always runs.
- [ ] **Step 2:** Run. Expect FAIL. Implement, run and expect PASS. Commit `feat(app): show the original tutorials`.

### Task 10: End-to-end smoke test and first release

**Files:**
- Create: `e2e/smoke.spec.ts`, `playwright.config.ts` (WebKit, `devices['iPhone 15']`, `webServer: npm run build && npm run preview`)
- Modify: `package.json` (script `e2e`), `README.md` (how to install on iPhone: open the URL in Safari, Share → Add to Home Screen, then Load APK from Files)

- [ ] **Step 1:** Write `smoke.spec.ts`, which is skipped unless an APK is present:
  1. open `/trainyard/`;
  2. upload the APK through the file input;
  3. go to Trainyard → Abbotsford → Red Line;
  4. drag across row 3 from column 1 to column 5 with `page.mouse`/touch;
  5. tap Start;
  6. expect "Solved!" within 15 s;
  7. go back and expect 1 star on Abbotsford.

  Then reload offline (`context.setOffline(true)`), and expect the app shell to load and Red Line still to show as solved.
- [ ] **Step 2:** Run `npm run e2e` and expect it to pass. Run `npm test` and expect it all green. Run `npm run typecheck` and expect it clean.
- [ ] **Step 3:** Check the built `dist/` for leaks: `grep -rE "hh002Oja3Giaa00|redLine|Abbotsford" dist/` must return nothing, since the original content arrives only from the APK at runtime.
- [ ] **Step 4:** Commit `test: end-to-end smoke on iPhone emulation`. **Ask Scott before pushing** (the push deploys the site). Push, wait for the Pages workflow, and confirm the live URL returns 200.
- [ ] **Step 5:** Tell Scott how to install it on his phone, and ask him to try Red Line on the real device.
