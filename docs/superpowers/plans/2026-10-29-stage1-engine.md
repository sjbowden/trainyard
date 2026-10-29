# Stage 1: Puzzle Codec and Rules Engine, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TypeScript library that decodes and encodes Trainyard puzzle/solution codes and simulates a run with the original game's rules. It is proven by replaying real trainyard.ca solutions of all 233 original puzzles.

**Architecture:** Pure, DOM-free TypeScript modules under `src/engine/`, usable in the browser later (Stage 2) and in Node now. A dev-only Node script extracts the original puzzles from the APK into a git-ignored `local/` folder. A second script scrapes known solutions into committed fixtures. A fixture test joins the two and replays every solution. That test is skipped when `local/` is absent, as in CI.

**Tech Stack:** TypeScript (strict), Vite (scaffold only; the app arrives in Stage 2), Vitest, `sql.js` (SQLite in WASM, also usable in the browser later), `fflate` (unzip), Node 26 with `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md`

**This is Stage 1 of 5.** Later plans, each written once the previous stage ships: 2) the playable PWA (board UI, track drawing, APK import in the browser, progress, default theme); 3) editor and link sharing; 4) solver and generator; 5) curated user-puzzle library and Original theme.

## Global Constraints

- Rule accuracy outranks everything. Every original puzzle must replay its fixture solutions to a win with the recorded `stepCount` and `trackCount`.
- **Never commit or publish:** `*.apk`, anything extracted from the APK (`local/`), the decompiled ActionScript, or original puzzle codes. Fixtures store **solution halves only**, keyed by level slug.
- Git in this repo: `user.name "Scott Bowden"`, `user.email "sjbowden@gmail.com"`, set with `git config` (repo-local), never the work email.
- Remote: GitHub account `sjbowden`, public repo `trainyard` (created in Task 6, after Scott confirms).
- Scrape trainyard.ca politely: one request at a time, ≥0.5 s apart, with a descriptive User-Agent.

## Reference: the original format and rules (from the decompiled `BlueprintViewer.swf`)

The authoritative source is the decompiled viewer, at `/tmp/claude-1000/-home-sjbowden-personal-trainyard/3e47383c-f81b-46ef-84a2-58f8418d859b/scratchpad/swf/out/scripts/ca/struct/ty/data/`. Regenerate it with JPEXS: `java -jar ffdec-cli.jar -export script out BlueprintViewer.swf`. Use it as a reference only, and do not copy it into the repo. The facts below are enough to implement from.

**Alphabet:** `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_` (index = value).
**Enums:** Side T=0 R=1 B=2 L=3. Color r=0 y=1 b=2 o=3 g=4 p=5 brown=6. Segment Empty=0 TR=1 TL=2 BL=3 BR=4 TB=5 LR=6.

**Code layout:** `char(cols) char(rows) puzzlePart [ "_" solutionPart ]`. Originals are `hh` (7×7). Cells run row-major from the top-left.
- **puzzlePart:** for each cell, either a piece token or part of a run of empty/track cells. A digit `n` (1–9) means n non-piece cells, and `0` means ten. A run of 10 is emitted as `0` and the count restarts.
- **solutionPart:** the same run-length digits for non-track cells. A track cell is one char `v`, with primary = `segments[floor(v/7)]` and secondary = `segments[v%7]`.
- **Piece tokens:**
  - `R`: rock.
  - `S` + side: a splitter, with the side as its entry side. It exits on (in+1)%4 and (in+3)%4, in that order.
  - `P` + color + `char(a*7+b)`: a painter joining sides a and b.
  - `O` + `char(side*9 + (n-1))` + color pairs: an outlet emitting n trains in order out of that side.
  - `G` + `char(bitmask T1 R2 B4 L8)` + `char(n-1)` + color pairs: a goal accepting entries on the masked sides and needing n colors.
  - **Color pairs:** each char packs two colors as `first*7 + second`, ⌈n/2⌉ chars. The second color of the last char is ignored when n is odd.

Examples: Red Line `hh002Oja3Giaa00` has a red outlet at (col1,row3) exiting Right and a goal at (5,3) entered from Left needing one red. Its best solution is `hh002Oja3Giaa00_003QQQ00` (cells 23–25 are `Q`=42 → primary LR, secondary Empty). Its trainyard.ca stats are trackCount 3000 and stepCount 4.

**Color mixing** (`mix(a,b)`): same color → itself. {y,r}→orange, {b,y}→green, {b,r}→purple. Anything else → brown.

**Simulation:** discrete half-steps that alternate, starting with A.
- **Half-step A, center:**
  1. Each live train is "given" to its current piece's center:
     - a track piece: nothing happens;
     - a painter: the train becomes the painter's color;
     - a splitter: the train dies and queues two trains on the splitter. A secondary color splits into its primaries, ordered as in `primaries` (orange=[y,r], green=[b,y], purple=[b,r]), with the first going to sidesOut[0]. Any other color splits into two of itself;
     - a goal: if the color is in the goal's remaining list, one instance is removed and the train dies. Otherwise the train dies **and it is a crash**;
     - an outlet: nothing happens, since this is a train's own spawn piece.
  2. Remove dead trains.
  3. **Mid collisions.** For every pair of live trains on the same piece whose current segments are equal, or form a cross (LR with TB): both take `mix` of the two colors.
  4. Remove dead trains.
  5. **Spawn.** In cell order, every outlet with trains left emits its next train, positioned on the outlet and heading out of `side`. Every splitter with queued trains releases them.
  6. Remove dead trains.
  7. **Solved check.** If every goal's list is empty, the game is over, and it is a **win if no crash has happened**. Leftover outlet trains or live trains do not matter.
- **Half-step B, edge:**
  1. **Edge collisions.** For each pair (i<j) of live trains:
     - same piece and same `nextSide`: train i takes the mix, and train j dies (they merge);
     - they are swapping cells head-on (each one's next cell is the other's piece, and the sides are opposite): both take the mix.
     After its inner loop, train i's piece, if it is a track piece, **toggles its switch**. The toggle happens only if the two segments share a side. It happens once per train on that tile, every B half-step.
  2. Remove dead trains.
  3. **Move.** Each live train moves to the neighbour cell across `nextSide` and enters it by the opposite side ("entry side"). Then:
     - a track piece: use the primary segment if it has the entry side, else the secondary. With neither, it's a crash;
     - a painter: it must enter by side a or b, then exits by the other;
     - a goal: it must enter by one of its sides, then heads to the opposite side;
     - a splitter: it must enter by `in`;
     - an empty cell, a rock or an outlet: crash.
  4. Remove dead trains.
- **Leaving the board is a crash.** *(The viewer wraps left/right edges into the adjacent row. That is a viewer bug, and we deliberately differ from it. The real game crashes.)*
- **Track count:** major = number of track cells' primary segments, minor = number of non-empty secondary segments. *(This is a hypothesis. Task 5 confirms it against the `trackCount` fixtures, which are encoded major*1000+minor.)*
- **Step count:** hypothesis: the number of B half-steps completed before the winning A half-step. Task 5 confirms or corrects it.

## Review Focus

1. **Malformed or truncated codes** (shared links will carry codes later). The decoder throws `CodecError` with a message; it never returns a half-filled board or loops.
2. **A train running off any edge,** including left/right, where the reference viewer wraps. It crashes, and it never appears on the adjacent row.
3. **Several trains passing one switch tile in the same B half-step.** The switch toggles once per train, as in the original. It must not be de-duplicated.
4. **A goal receiving a second train of a color it needed only once.** That is a crash, even if the goal is otherwise complete.
5. **A puzzle whose goals are all satisfied while an outlet still holds trains.** That is a win, as in the original. "Tidying" it into a loss breaks original puzzles.

Each item has a named test in the task that owns the code (Tasks 2 and 3).

---

### Task 1: Repository and toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md`, `CLAUDE.md`, `src/engine/index.ts` (empty barrel)
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run typecheck` (tsc --noEmit), `npx tsx <script>`.

- [ ] **Step 1:** Run `git init -b main`, then `git config user.name "Scott Bowden"` and `git config user.email "sjbowden@gmail.com"`. Verify with `git config user.email` → `sjbowden@gmail.com`.
- [ ] **Step 2:** Create `.gitignore` containing at least `node_modules/`, `dist/`, `*.apk`, `local/`, `*.swf`, `.DS_Store`.
- [ ] **Step 3:** Run `npm init -y`, set `"type": "module"` and `"private": true`, and run `npm i -D typescript vitest tsx @types/node` and `npm i sql.js fflate`. Then `npm i -D @types/sql.js`. Add the scripts `test`, `typecheck`, `extract`, `scrape:fixtures`. Use strict `tsconfig` (`"strict": true, "noUncheckedIndexedAccess": true, "module": "ESNext", "moduleResolution": "Bundler", "target": "ES2022"`).
- [ ] **Step 4:** Write `tests/smoke.test.ts` asserting that `import('../src/engine/index.ts')` resolves. Then run `npm test` → 1 passed, and `npm run typecheck` → no errors.
- [ ] **Step 5:** `CLAUDE.md` notes for future sessions: project purpose (one line, plus a link to the spec), the never-commit list from Global Constraints, the `npm test` / `npm run extract` commands, and that `.md` files are shown to Scott by opening them in Windows via `explorer.exe "$(wslpath -w <file>)"`.
- [ ] **Step 6:** Commit: `git add -A && git commit -m "chore: scaffold TypeScript engine project"`. Before committing, check `git status --short`: it must list no `.apk` file.

### Task 2: Types and codec

**Files:**
- Create: `src/engine/types.ts`, `src/engine/codec.ts`
- Modify: `src/engine/index.ts` (re-export)
- Test: `tests/engine/codec.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Side = 0 | 1 | 2 | 3;              // T R B L
  export type Color = 0 | 1 | 2 | 3 | 4 | 5 | 6; // r y b o g p brown
  export type Segment = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Empty TR TL BL BR TB LR
  export type Piece =
    | { kind: 'empty' } | { kind: 'rock' }
    | { kind: 'track'; primary: Segment; secondary: Segment }
    | { kind: 'outlet'; side: Side; colors: Color[] }
    | { kind: 'goal'; sides: Side[]; colors: Color[] }
    | { kind: 'painter'; color: Color; a: Side; b: Side }
    | { kind: 'splitter'; in: Side };
  export interface Board { cols: number; rows: number; cells: Piece[] } // row-major; goal.sides kept ascending
  ```
- Produces (`codec.ts`): `class CodecError extends Error`, `decodeBoard(code: string): Board`, `encodeBoard(board: Board, parts?: { puzzle?: boolean; solution?: boolean }): string` (both default true), `splitCode(code: string): { puzzle: string; solution: string }` (the puzzle keeps its `hh` prefix, and the solution excludes the `_`), and `segmentSides(s: Segment): [Side, Side] | null`.

- [ ] **Step 1: Write failing tests** in `tests/engine/codec.test.ts`:
  - `decodes Red Line`: `decodeBoard('hh002Oja3Giaa00')` → cols 7, rows 7, 49 cells. `cells[22]` = `{kind:'outlet', side:1, colors:[0]}`, `cells[26]` = `{kind:'goal', sides:[3], colors:[0]}`, and every other cell is `empty`.
  - `applies a solution`: `decodeBoard('hh002Oja3Giaa00_003QQQ00')`. Cells 23, 24 and 25 are `{kind:'track', primary:6, secondary:0}`.
  - `decodes painters (Kes)`: `decodeBoard('hhGeah2Geaa2Geao04PcoPaoPaoPaoPaoPaoPbo04GbahOaJOaJOaJOaJOaJGbao')`. `cells[0]` = `{kind:'goal', sides:[2], colors:[1]}` (`e`=4 → mask B, `a` → 1 color, `h`=7 → yellow). Assert there are exactly 7 painters, and that the first painter in cell order is `{kind:'painter', color:2, a:2, b:0}` (`c`=2 blue, `o`=14 → a=B, b=T).
  - `decodes the welcome tutorial board`: `decodeBoard('hh002OjC3GiaC00')`. The outlet at index 22 is green (`C`=28 → colors[4]) exiting R, and the goal at 26 needs green.
  - `round-trips every code it decodes`: `encodeBoard(decodeBoard(x)) === x` for the four codes above.
  - `rejects malformed codes` (Review Focus 1): each of `''`, `'h'`, `'hhO'`, `'hhGa'`, `'hh!'`, `'hh002Oja3Giaa00_00#'` and a code whose cells overflow 49 throws `CodecError`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/codec.test.ts`. Expect FAIL (module not found).
- [ ] **Step 3: Implement** `codec.ts` following the format reference. Validate as you go: an unknown char, running out of characters mid-token, a cell count ≠ cols×rows at the end, and a side or color index out of range each throw `CodecError`. The encoder emits exactly the original's form: runs flushed as digits, `0` for a run of ten, and the solution part omitted when there is no track.
- [ ] **Step 4:** Run the tests. Expect all to pass. Then run `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(engine): decode and encode puzzle/solution codes`.

### Task 3: Simulator

**Files:**
- Create: `src/engine/sim.ts`, `docs/rules.md` (the rules in our own words: the reference section above, tidied, so future stages need no SWF)
- Test: `tests/engine/sim.test.ts`, `tests/engine/helpers.ts` (a tiny board builder: `board(spec: Record<string, Piece>)` keyed by `"col,row"`, the rest empty, 7×7)

**Interfaces:**
- Consumes: `Board`, `Piece`, `Side`, `Color`, `Segment`, `segmentSides` from Task 2.
- Produces:
  ```ts
  export interface TrainState { id: number; color: Color; cell: number; nextSide: Side; segment: Segment | null; alive: boolean }
  export type Outcome = 'running' | 'won' | 'crashed' | 'stalled';
  export interface HalfStepEvents { phase: 'A' | 'B'; crashes: number[] /* cells */; painted: number[]; splits: number[]; delivered: number[]; switched: number[]; merged: number[] }
  export interface Run { readonly board: Board /* live copy: switches and goal lists mutate */; readonly trains: readonly TrainState[]; readonly outcome: Outcome; readonly halfSteps: number; readonly steps: number; halfStep(): HalfStepEvents }
  export function createRun(board: Board): Run;            // deep-copies the board
  export function simulate(board: Board, maxHalfSteps?: number /* default 2000 */): { outcome: Exclude<Outcome,'running'>; steps: number; halfSteps: number };
  export function trackCount(board: Board): { major: number; minor: number };
  ```
  The `HalfStepEvents` fields exist so that Stage 2 can play sounds and animate. Fill them faithfully.
- Outcome rules:
  - `crashed` is set as soon as any crash happens, but the run keeps stepping until the solved check. This matches the original, which reports the loss at game over. **However,** `simulate` may stop at the first crash.
  - `won` is set at the solved check with no crash.
  - `stalled` means no live trains, no outlet or splitter holding trains, and goals unsatisfied.
  - `steps` counts completed B half-steps.

- [ ] **Step 1: Write failing tests** in `tests/engine/sim.test.ts`, one per rule, using `helpers.board`:
  - `straight line delivers`: Red Line plus its solution → `simulate` → `won`, steps 4. (Steps is a hypothesis; Task 5 may correct the definition and this number.)
  - `mixes colors on merge`: red and blue outlets feed one tile from two sides, sharing a `nextSide`, into a goal needing purple → won.
  - `head-on swap mixes both`.
  - `crossing mixes only when on the cross at the same time`.
  - `painter recolors`.
  - `splitter splits secondaries into primaries in order`: an orange train splits so that sidesOut[0] gets yellow and sidesOut[1] gets red. Assert the colors of the spawned trains by `nextSide`.
  - `splitter duplicates primaries`.
  - `splitter entered from wrong side crashes`.
  - `switch toggles after a train passes`: two red trains in sequence through a Y-switch reach two different goals.
  - `switch toggles once per train in the same half-step` (Review Focus 3).
  - `wrong color into goal crashes`.
  - `surplus color into goal crashes` (Review Focus 4): the goal needs [r] and receives r, r.
  - `win with trains still in an outlet` (Review Focus 5): the goal needs [r], the outlet holds [r, r], the first train is delivered → `won`.
  - `leaving any board edge crashes` (Review Focus 2): four cases, one per edge. On the right edge, assert that no train ever appears in the next row's col 0.
  - `entering rock/outlet/empty crashes`.
  - `stalls when nothing can move`.
  - `trackCount counts primaries and secondaries`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/sim.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** `sim.ts` following the half-step order in the reference exactly, including the pair-iteration order (i<j, in array order) and the per-train switch toggle inside the edge-collision loop. Trains are kept in creation order.
- [ ] **Step 4:** Run the tests. Expect all to pass. Then run `npm run typecheck`.
- [ ] **Step 5:** Write `docs/rules.md`.
- [ ] **Step 6:** Commit `feat(engine): simulate runs with original rules`.

### Task 4: APK extractor

**Files:**
- Create: `scripts/extract-apk.ts`, `src/data/apk.ts` (DOM-free and reused by the browser import in Stage 2)
- Test: `tests/data/apk.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface World { slug: string; name: string; starsToUnlock: number; group: 'main' | 'bonus'; ordinal: number }
  export interface Level { slug: string; worldSlug: string; name: string; stars: number; code: string; ordinal: number }
  export interface Tutorial { slug: string; worldSlug: string; name: string; xml: string; ordinal: number }
  export interface Collection { id: 'trainyard' | 'express'; worlds: World[]; levels: Level[]; tutorials: Tutorial[] }
  export async function readApk(bytes: Uint8Array): Promise<Collection[]>; // reads assets/trainyardStatic.db and assets/trainyardExpressStatic.db; ignores *_dev.db
  ```
- `scripts/extract-apk.ts <path.apk>` writes `local/collections.json`. It defaults to `android-comnoodlecaketrainyard-0.apk`, else the first `*.apk` in the repo root.

- [ ] **Step 1: Write failing tests**, all skipped (`describe.skipIf`) unless an `*.apk` is present in the repo root:
  - `reads both collections`: trainyard has 23 worlds and 165 levels, express has 13 worlds and 68 levels.
  - `maps world groups`: `oakville` → bonus, `starsToUnlock` 424; `brampton` → 6.
  - `redLine`: code `hh002Oja3Giaa00`, stars 1, world `abbotsford`.
  - `every level code decodes`: `decodeBoard(level.code)` doesn't throw for all 233.
  - `both APKs agree`: when both APKs are present, the levels are deep-equal.
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3: Implement** with `fflate.unzipSync`, then `sql.js` (`initSqlJs()`; in Node, locate the wasm through `require.resolve('sql.js/dist/sql-wasm.wasm')`, and let Stage 2 supply its own `locateFile`). Read the columns named in the spec's data table, and map `groupID` 0→main, 1→bonus. Throw `Error('Not a Trainyard APK')` if either db is missing.
- [ ] **Step 4:** Run the tests, then `npm run extract`. Verify that `local/collections.json` exists and that `git status --short` doesn't list it.
- [ ] **Step 5:** Commit `feat(data): read original puzzles from the APK`.

### Task 5: Solution fixtures and accuracy test

**Files:**
- Create: `scripts/scrape-fixtures.ts`, `fixtures/solutions.json` (committed: solution halves only), `tests/accuracy.test.ts`

**Interfaces:**
- Consumes: `readApk` output (`local/collections.json`), `decodeBoard`, `simulate`, `trackCount`.
- Fixture shape: `{ [levelSlug: string]: { solution: string; trackCount: number; stepCount: number; source: string /* encodedID */ }[] }`. The `solution` is the text after `_` in the solution page's `ys` flashvar.
- Endpoints (from the spec):
  - Solution list: `https://trainyard.ca/system/pages/data/getItemsAsJSON.php?filterType=<economical|shortest|longest>&filterData=&resultType=blueprintsForLevel&extraData=<slug>&pageIndex=1&itemsPerPage=3`.
  - Solution page: `https://trainyard.ca/<encodedID>`, taking the `ys:"…"` value.

- [ ] **Step 1:** Implement the scraper. For every level slug in `local/collections.json`, take the top 3 from each of economical, shortest and longest (up to 9, de-duplicated by id). Fetch each page, and assert that the `ys` puzzle half equals the APK code. A mismatch is logged and the solution skipped, and the puzzle half is **not** written. Run requests serially ≥0.5 s apart, and resume from the existing file. Run it once with `npm run scrape:fixtures`. It takes about 2,000 requests, roughly 20 minutes, so run it in the background.
- [ ] **Step 2: Write `tests/accuracy.test.ts`** (`skipIf` no `local/collections.json`). For each fixture: `decodeBoard(apkCode + '_' + solution)`. Then `simulate` → `won`. Check `steps === stepCount`, and that `trackCount(board)` gives `major*1000+minor === trackCount`. Report failures grouped by rule (outcome vs steps vs track count), not one by one.
- [ ] **Step 3:** Run `npx vitest run tests/accuracy.test.ts`. If the step or track count hypotheses fail uniformly, correct the definition in `sim.ts` (e.g. off by a constant, or counting A half-steps). Then add a unit test pinning the corrected definition, and update `docs/rules.md`. If individual puzzles fail, debug them with superpowers:systematic-debugging against the reference viewer's logic. Never special-case a puzzle.
- [ ] **Step 4:** Expected: every fixture passes. Record the counts (puzzles covered, solutions replayed) in the commit message.
- [ ] **Step 5:** Commit `test: replay trainyard.ca solutions for all original puzzles`. Before committing, grep `fixtures/solutions.json` for `hh` at the start of any string: there must be none.

### Task 6: CI and GitHub remote

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:** Workflow on push and PR: Node 22+, `npm ci`, `npm run typecheck`, `npm test`. The APK-dependent suites skip themselves.
- [ ] **Step 2:** Run `npm test` locally with `local/` temporarily renamed. Expect APK and accuracy tests to show skipped and all others to pass. Then restore it.
- [ ] **Step 3:** **Ask Scott before this step** (outward action). Create the remote and push: `GH_TOKEN=$(gh auth token --user sjbowden) gh repo create sjbowden/trainyard --public --source . --push`. Verify with `git log origin/main -1`, and check that CI passes with `gh run list`.
- [ ] **Step 4:** Commit `ci: typecheck and test on push` (before the push in Step 3).
