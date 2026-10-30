# Stage 4: Solver and Puzzle Generator, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scott can ask for a fresh puzzle at a chosen difficulty and get one that is guaranteed solvable and not trivial. The editor also gets an "Ask the solver" proof, the spec's alternative to solving a puzzle yourself before sharing.

**Architecture:**
- **Solver:** a pure, DOM-free module in `src/solver/`. It replays the puzzle through `src/engine` and lays track lazily, only where a train is about to go.
- **Generator:** builds puzzles backwards from a known solution. The solver then grades and filters the candidates.
- **Off the main thread:** both run in a Web Worker, so the UI never freezes. The calibration against the originals is a dev script with committed numbers.

**Tech Stack:** as Stages 2–3, plus a Vite module worker. There are no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md`. Rules: `docs/rules.md`.

**Stage 4 of 5.** Next: the user-puzzle library and the Original theme (Stage 5).

## Global Constraints

- All earlier Global Constraints apply. Rules come only from `src/engine`. A solution the solver reports is valid only if `simulate()` says `won`.
- **No original puzzle codes are committed.** Calibration output keys stats by slug and holds only numbers.
- **Generated puzzles are always solvable.** Each one is built from a solution that `simulate()` confirmed. That solution is the puzzle's proof, so a generated puzzle can be shared at once.
- **The UI never blocks.** Solving and generating run in a worker with a time budget, and they can be cancelled.
- **This stage's release asks Scott first.**

## How the solver works (the decision this plan rests on)

The solver runs a depth-first search driven by simulation.

1. **A node** is a partial track layout. The solver simulates it from the start.
2. **Branching:** when a train is about to enter a cell with no usable segment for its entry side (a crash), the run stops and the solver branches on what to lay there:
   - **an empty cell:** one of the 3 exits (straight, left or right);
   - **a cell that already holds a segment:** add the new segment as the secondary, or as the primary. That gives a switch or a cross, so up to 6 children.
3. **Rebuilding:** each child re-simulates from the start. Adding a secondary changes how earlier trains toggled that cell, so the whole run must be replayed.
4. **Pruning:** a crash that no laying can fix (leaving the board, hitting a rock or a station, the wrong color at a goal, or a wrong-side entry) ends the branch. So does going over the segment budget.
5. **Iterative deepening** on the segment count, so the first solution found uses the fewest segments.
6. **Child order:** exits that bring the train closer to a goal still needing its color come first.
7. **Results:** each search has a node budget, and returns `{ status: 'solved', solution, segments, nodes } | { status: 'unknown', nodes }`.

This won't solve every hard original within a phone-friendly budget, and that's acceptable. It isn't needed to make generated puzzles solvable, which construction guarantees. It grades them (the nodes it took and the fewest segments) and rejects trivial ones.

## How the generator works

Construction, from a seeded random source (`mulberry32`):

1. **Outlets:** pick 1–4 outlets on random cells, with exit sides that face into the board and train lists built from the difficulty's palette.
2. **Routes:** lay random self-avoiding routes as real track from each outlet's exit.
   - Routes may **join** another route (a merge, so colors mix).
   - From an outlet with several trains, routes may **branch at a switch**, so successive trains go different ways.
   - Routes may **pass a painter** placed on a straight cell, or **end at a splitter** whose two outputs each continue as a route.
   - Each route ends at a free cell, which becomes a goal entered from that side.
3. **Recording what arrives:** with every goal accepting anything, simulate the board and record the colors each goal receives. Reject the candidate if anything crashes, any outlet train never arrives, or the run doesn't end.
4. **Goals:** set each goal's needed colors to exactly what it received. Re-simulate and require `won`. That track is the proof.
5. **Rocks:** add rocks on random free cells, keeping only those that leave the proof intact. They block shortcuts.
6. **Finish:** strip the track, which leaves the puzzle code.

Then grading: run the solver within the difficulty's node budget.
- **Too easy:** solved in fewer than the band's minimum nodes, or with fewer than its minimum segments. Reject.
- **In band:** solved inside the band. Keep.
- **Unknown within budget:** keep it only for **Very hard**, since construction already guarantees it can be solved.

Keep generating until a candidate is kept, or the time budget runs out. In that case, return the best candidate seen so far and tell Scott it may be a little easier than asked.

## Difficulty bands (starting values; Task 3 replaces them with calibrated numbers)

| Band | Features | Solver band |
|------|----------|-------------|
| Easy | 1–2 outlets, primary colors, no splitters or painters | ≥ 6 segments |
| Medium | adds merges (mixing) and painters | ≥ 10 segments and ≥ 2,000 nodes |
| Hard | adds switches and splitters, 2–3 outlets, rocks | ≥ 14 segments and ≥ 20,000 nodes |
| Very hard | everything, 3–4 outlets | ≥ 18 segments and ≥ 200,000 nodes, or unknown within the budget |

Task 3 calibrates these against the originals' stars: the median solver nodes and segments for 1–3★, 4–8★, 9–15★ and 16+★ originals.

## Review Focus

1. **A generated puzzle whose stored proof doesn't win** under `simulate()`, for example because a rock placement or goal-color step broke it. It must never be offered or shared. (Task 4.)
2. **The solver reporting `solved` with a track that doesn't win.** Every solved result is checked with `simulate()` before it's returned. (Task 1.)
3. **A generator or solver run that never ends,** or freezes the phone. The worker has hard node and time budgets and can be cancelled. Leaving the screen cancels it. (Tasks 1, 5 and 6.)
4. **The same seed must give the same puzzle** (reproducible bug reports), and different seeds must give different puzzles. (Task 4.)
5. **Generated boards are valid puzzles:** at least one outlet and one goal, no goal needing more than 9 trains, everything encodable, and no original puzzle reproduced exactly. (Task 4.)

---

### Task 1: Solver

**Files:** Create `src/solver/solve.ts`. Test: `tests/solver/solve.test.ts`.

**Interfaces:**
```ts
export interface SolveOptions { maxNodes?: number /* default 200_000 */; maxSegments?: number /* default 40 */; deadline?: number /* performance.now() ms */ }
export type SolveResult =
  | { status: 'solved'; solution: string /* solution half */; segments: number; nodes: number }
  | { status: 'unknown'; nodes: number; reason: 'budget' | 'deadline' | 'exhausted' };
export function solve(puzzleCode: string, opts?: SolveOptions): SolveResult;
```

- [ ] **Step 1: Write the failing tests.**
  - It solves Red Line with 3 segments, the fewest.
  - It solves a merge board, an L-shaped route around a rock, a painter board, a splitter board, and a board that needs a switch (two red trains to two goals).
  - Every solved result wins under `simulate()`.
  - It returns `unknown` with `budget` on a tiny `maxNodes`.
  - It returns `exhausted` for an unsolvable board (a goal behind rocks).
  - It respects `deadline`.
- [ ] **Step 2:** Run and expect FAIL. Implement the search exactly as "How the solver works" says, verifying each solved result with `simulate()`. Run and expect PASS.
- [ ] **Step 3:** Commit `feat(solver): simulation-driven track search`.

### Task 2: Solver against the originals

**Files:** Create `scripts/calibrate-solver.ts` and `fixtures/solver-calibration.json` (committed: slug → `{stars, status, segments, nodes}`, no codes). Test: `tests/solver/originals.test.ts` (skipped without `local/collections.json`).

- [ ] **Step 1:** Write the calibration script. It runs `solve` on all 233 originals with `maxNodes` 2,000,000 and writes the JSON. Run it in the background and record the run time.
- [ ] **Step 2: Write a test** (it reads the committed JSON and the APK data). For every original marked solved, re-solving gives a solution that wins. **The solver's minimal segment count must be no more than the best player solution's** (major + minor, from the economical solutions in `fixtures/solutions.json`). A higher count means the search is missing solutions.
- [ ] **Step 3:** Write `docs/solver-calibration.md`: the share of originals solved per star band, and the median nodes and segments per band. Commit `test(solver): calibrate against the original puzzles`.

### Task 3: Difficulty bands from calibration

**Files:** Create `src/solver/difficulty.ts`. Test: `tests/solver/difficulty.test.ts`.

**Interfaces:**
```ts
export type Difficulty = 'easy' | 'medium' | 'hard' | 'veryHard';
export interface Band { minSegments: number; minNodes: number; maxNodes: number; acceptUnknown: boolean }
export const BANDS: Record<Difficulty, Band>;   // numbers from docs/solver-calibration.md
export function grade(result: SolveResult): Difficulty | 'tooEasy';
```

- [ ] **Step 1:** Set the `BANDS` numbers from the calibration medians, and write each band's source band into a comment.
- [ ] **Step 2: Write the failing tests:** `grade` puts the calibration's median 1–3★ original in `easy`, and 16+★ in `veryHard` (or `unknown`, accepted for very hard). A 3-segment solve is `tooEasy`.
- [ ] **Step 3:** Run, implement, run and expect PASS. Commit `feat(solver): difficulty bands calibrated on the originals`.

### Task 4: Generator

**Files:** Create `src/solver/random.ts` (`mulberry32`) and `src/solver/generate.ts`. Test: `tests/solver/generate.test.ts`.

**Interfaces:**
```ts
export interface Generated { code: string; proof: string; difficulty: Difficulty; seed: number; segments: number; nodes: number | null; easierThanAsked: boolean }
export function generateCandidate(seed: number, difficulty: Difficulty): { code: string; proof: string } | null;  // construction only
export function generate(difficulty: Difficulty, opts: { seed?: number; deadline: number; onProgress?: (tried: number) => void }): Generated;
```

- [ ] **Step 1: Write the failing tests:**
  - For 200 seeds per difficulty, every non-null candidate's `code` decodes, `code + '_' + proof` wins under `simulate()`, and the board has ≥ 1 outlet and ≥ 1 goal, with no goal needing more than 9 trains (Review Focus 1 and 5).
  - Easy candidates have no splitters or painters.
  - Hard candidates sometimes include a switch in the proof.
  - The same seed gives the same code, and 50 seeds give at least 45 distinct codes (Review Focus 4).
  - `generate` returns within its deadline.
  - With `local/collections.json` present, no generated code equals an original's, compared after re-encoding.
- [ ] **Step 2:** Run, implement construction exactly as "How the generator works" says, run and expect PASS. Commit `feat(solver): generate puzzles from known solutions`.

### Task 5: Worker

**Files:** Create `src/solver/worker.ts` (a module worker) and `src/app/solverClient.ts`.

**Interfaces:**
```ts
// solverClient.ts
export function generateInWorker(difficulty: Difficulty, onProgress: (tried: number) => void): { result: Promise<Generated>; cancel(): void };  // 20 s budget
export function solveInWorker(code: string): { result: Promise<SolveResult>; cancel(): void };                                            // 20 s budget
```

- [ ] **Step 1:** Implement the worker (`new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' })`). `cancel` terminates it.
- [ ] **Step 2:** Make sure the build includes the worker and the service worker precaches it (`npm run build`, then check `dist/` and `sw.js`). Commit `feat(app): run the solver and generator off the main thread`.

### Task 6: Screens

**Files:** Create `src/app/screens/GenerateScreen.tsx`. Modify `src/app/router.ts` (`#/new`), `src/app/App.tsx`, `src/app/screens/HomeScreen.tsx` (a **New puzzle for me** tile), `src/app/screens/EditorScreen.tsx` (an **Ask the solver** button) and `src/app/customPuzzles.ts` (`source: 'generated'`).

**Behavior:**
- **Choosing a difficulty:** **New puzzle for me** shows the four difficulties. Tapping one shows "Building a puzzle… (tried N)" with a Cancel button, then opens the puzzle to play.
- **Saving:** a generated puzzle is saved in My puzzles under **Generated**, named like "Hard #4821" from its seed. It is shareable straight away, since its proof is stored.
- **When it runs out of time:** it shows "This one may be a little easier than you asked."
- **Editor:** **Ask the solver** runs `solveInWorker`. When it finds a solution, it stores the solution as the proof (so Share unlocks) and shows "The solver found a solution." When it doesn't, it says "The solver couldn't find a solution in time; solve it yourself to share it."
- **Cancelling:** leaving either screen cancels the worker (Review Focus 3).

- [ ] **Step 1: Write failing unit tests:** the `#/new` route; My puzzles lists a Generated section; and a generated puzzle is shareable.
- [ ] **Step 2:** Implement. Then write an e2e test: New puzzle for me → Easy → a puzzle opens within 20 s → Back → it's listed and ready to share. Also test Ask the solver on the editor's "Test line" puzzle: Share unlocks without playing.
- [ ] **Step 3:** Run `npm test`, `npm run e2e` and `npm run typecheck`, all green. Look at screenshots. Commit `feat(app): fresh puzzles at a chosen difficulty`.

### Task 7: Release

- [ ] **Step 1:** Run a final whole-branch review (a fresh reviewer, on the most capable model) with this plan's Review Focus, then make one pass of fixes, each fix with a test that fails first.
- [ ] **Step 2:** Update `README.md` and `docs/rules.md` (a pointer to the solver).
- [ ] **Step 3:** **Ask Scott**, then push and confirm the deploy.
