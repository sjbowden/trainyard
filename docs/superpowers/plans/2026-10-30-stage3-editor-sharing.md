# Stage 3: Puzzle Editor and Share Links, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scott can design puzzles on his phone, prove each one solvable by solving it, and share it as a link. Anyone who opens the link can play it. In the installed app, a shared puzzle is kept in "Shared with me".

**Architecture:**
- **Pure modules:** the link format, the custom-puzzle store and the editor model are pure, unit-tested modules.
- **Screens:** the editor and the shared-puzzle screens are Preact.
- **Reused pieces:** custom puzzles use the same `Board` and code format, `PuzzleScreen`, the engine and progress as the originals.
- **No server.** The whole puzzle lives in the link.

**Tech Stack:** as Stage 2. `fflate` (already a dependency) deflates link payloads.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md`. The Stage 2 plan holds the app conventions.

**Stage 3 of 5.** Next: the solver and generator (Stage 4), then the user-puzzle library and the Original theme (Stage 5).

## Global Constraints

- Everything in the Stage 1 and Stage 2 Global Constraints still applies: American English, iPhone first, no original content in the build, and all run logic through `src/engine`.
- **Originals stay out of the editor and links** (spec ruling). The editor starts from an empty board and cannot open an APK puzzle. Links use our own wrapped format, never a bare original code.
- **Links are integrity-checked** (Stage 1 final ruling). A damaged or truncated link shows "This puzzle link is damaged" and never a different puzzle.
- **A puzzle can be shared only after its author has solved it** (spec). Changing any piece after a solve clears that proof.
- Small fixes can be pushed once tests pass. **This stage's release asks Scott first** (memory `push-small-fixes`).

## Decisions made for this plan (Scott may override)

- **Share link:** `https://sjbowden.github.io/trainyard/#/s/<payload>`.
  - The payload is `1.` + base64url(deflate(JSON `{ n: name, c: code }`)) + `.` + an 8-hex-digit FNV-1a checksum of the text before the last dot.
  - `c` is a puzzle-only code (no solution).
  - Names are capped at 40 characters.
- **Clipboard:** iOS won't let a page read the clipboard without a tap. So a shared link opened in Safari shows the puzzle, playable, with an **Add to my app** button that copies the link. The installed app's "Shared with me" list then has a **Paste puzzle link** button. This replaces the spec's "the app offers to add it next time it opens", which iOS doesn't allow.
- **Opening a link inside the installed app** (rare on iOS) adds the puzzle straight away.
- **Pieces the editor offers:**
  - **Rock.**
  - **Outlet:** an exit side and 1–9 trains.
  - **Goal:** entry sides and 1–9 trains.
  - **Painter:** a color, straight only (left–right or top–bottom), like the originals.
  - **Splitter:** an entry side.

  The colors offered are the six the original editor offered (red, yellow, blue, orange, green and purple); brown is left out.
- **A puzzle needs at least one outlet and one goal** before it can be tested.

## Review Focus

1. **A damaged, truncated or hand-edited link,** or one from a future link version. It shows a clear message and never crashes or loads a different puzzle. (Task 1.)
2. **An editor change after the puzzle was solved,** such as moving, recoloring or deleting a piece. The puzzle is no longer shareable until it is solved again. (Task 3.)
3. **Opening the same shared link twice, or pasting a link that is already saved.** No duplicate is created. (Task 2.)
4. **Long names, emoji or odd characters in a name,** which must round-trip through the link, and **a name that is empty.** (Task 1.)
5. **Deleting a custom puzzle.** Its progress goes with it, and the original puzzles' progress is untouched. (Task 2.)

---

### Task 1: Share link format

**Files:** Create `src/app/share.ts`. Test: `tests/app/share.test.ts`.

**Interfaces:**
```ts
export interface SharedPuzzle { name: string; code: string }   // code: puzzle-only, e.g. 'hh002Oja3Giaa00'
export class LinkError extends Error {}
export function encodeShare(p: SharedPuzzle): string;          // the payload after '#/s/'
export function decodeShare(payload: string): SharedPuzzle;    // throws LinkError("This puzzle link is damaged.") or LinkError("This puzzle link needs a newer version of the app.")
export function shareUrl(p: SharedPuzzle, base?: string /* location.origin + '/trainyard/' */): string;
```

- [ ] **Step 1: Write the failing tests.**
  - It round-trips a puzzle. Also with a 40-character emoji name, and with an empty name, which reads back as "Untitled".
  - It trims names to 40 characters.
  - The payload is not an original-format code (it never starts with `hh`).
  - Every single-character change, and every truncation of a valid payload, throws `LinkError`.
  - A version of `2.` throws the "newer version" message.
  - A payload whose code fails `decodeBoard` throws "damaged".
  - It rejects a solution half in `code`.
- [ ] **Step 2:** Run the tests and expect FAIL. Implement. Run again and expect PASS.
- [ ] **Step 3:** Commit `feat(app): share link format`.

### Task 2: Custom puzzle store

**Files:** Create `src/app/customPuzzles.ts`. Modify `src/app/store.ts` (reuse its connection and timeout helpers by exporting `withStore`). Test: `tests/app/customPuzzles.test.ts`.

**Interfaces:**
```ts
export interface CustomPuzzle {
  id: string;                    // 'm-<random>' for mine, 's-<checksum>' for shared (so the same link dedupes)
  source: 'mine' | 'shared';
  name: string;
  code: string;                  // puzzle-only code
  proof: string | null;          // mine: the solution half that solved this exact code; null = not yet solved
  created: number;               // ms
}
export async function listCustomPuzzles(): Promise<CustomPuzzle[]>;     // newest first; [] on storage failure
export async function saveCustomPuzzle(p: CustomPuzzle): Promise<void>;
export async function addShared(s: SharedPuzzle): Promise<CustomPuzzle>; // returns the existing entry when it's already saved
export async function deleteCustomPuzzle(id: string): Promise<void>;    // also removes progress key `custom/<id>`
```
Progress for custom puzzles uses the key `custom/<id>` in the existing `Progress`.

- [ ] **Step 1: Write the failing tests:**
  - saving and listing work, newest first;
  - `addShared` twice with the same puzzle gives one entry;
  - delete removes the puzzle and `custom/<id>` progress, and leaves `trainyard/redLine` progress alone;
  - a storage failure lists `[]`.
- [ ] **Step 2:** Run the tests and expect FAIL. Implement. Run again and expect PASS. Commit `feat(app): store custom puzzles on the device`.

### Task 3: Editor model

**Files:** Create `src/app/editor.ts`. Test: `tests/app/editor.test.ts`.

**Interfaces:**
```ts
export type Tool = 'rock' | 'outlet' | 'goal' | 'painter' | 'splitter' | 'erase';
export const EDITOR_COLORS: Color[];   // [0,1,2,3,4,5]
export function emptyBoard(): Board;   // 7×7
export function placePiece(b: Board, cell: number, tool: Tool): Board;  // a default piece: outlet {side: R, colors:[red]}, goal {sides:[L], colors:[red]}, painter {red, L–R}, splitter {in: L}; 'erase' empties the cell
export function updatePiece(b: Board, cell: number, piece: Piece): Board;
export function problems(b: Board): string[];  // e.g. 'Add at least one outlet', 'Add at least one goal'; [] when testable
export function proofHolds(code: string, proof: string | null): boolean;  // proof is a solution half; replays it with simulate() and checks 'won'
```

- [ ] **Step 1: Write the failing tests:**
  - placing and erasing each tool works;
  - pieces never land on track (the editor board has none);
  - `problems` lists what's missing;
  - `proofHolds` is true for Red Line with `003QQQ00`;
  - `proofHolds` is false after the goal moves (Review Focus 2), and false for `null`.
- [ ] **Step 2:** Run the tests and expect FAIL. Implement. Run again and expect PASS. Commit `feat(app): editor model`.

### Task 4: Editor screens

**Files:** Create `src/app/screens/MyPuzzlesScreen.tsx`, `src/app/screens/EditorScreen.tsx` and `src/app/screens/PieceSheet.tsx`. Modify `src/app/router.ts` (routes `#/mine`, `#/edit/:id`, `#/play/:id`), `src/app/App.tsx`, `src/app/screens/HomeScreen.tsx` (a **My puzzles** tile) and `src/app/styles.css`.

**Behavior:**
- **My puzzles:** a **New puzzle** button, then a list of puzzles, each showing its name and a solved/shareable badge. Tapping a puzzle opens it in the editor.
- **Editor layout:** a name field at the top, the board in the middle, and a tool row underneath (Rock, Outlet, Goal, Painter, Splitter, Erase).
  - Tapping a cell places the selected tool's piece.
  - Tapping an existing piece opens **PieceSheet**: exit or entry sides as four arrow toggles, and a train list where you tap colors to add and tap a chip to remove (1–9). A painter gets a color and a ↔/↕ toggle; a splitter gets its entry side. A **Delete** button removes the piece.
- **Editor buttons:**
  - **Test:** plays it in `PuzzleScreen`. A win stores the proof.
  - **Share:** enabled only while `proofHolds`. It uses `navigator.share` with the link where available, and otherwise copies it and shows "Link copied".
  - **Delete puzzle:** asks for confirmation first.
- **Saving:** every edit is saved (debounced, flushed on leaving, as in `PuzzleScreen`), and any edit to pieces sets `proof` to null.
- **Playing your own puzzle:** `#/play/:id` uses `PuzzleScreen` with progress key `custom/<id>`.

- [ ] **Step 1: Write failing unit tests** for the new routes and for `MyPuzzlesScreen`: it lists puzzles and shows the shareable badge only when `proof` holds.
- [ ] **Step 2:** Implement the screens.
- [ ] **Step 3: Write an e2e test.**
  1. Go to My puzzles → New puzzle, and name it "Test line".
  2. Place an outlet at (1,3) and a goal at (5,3).
  3. Share is disabled.
  4. Test, draw the line, and solve it.
  5. Back in the editor, Share is enabled.
  6. Move the goal, and Share is disabled again.
- [ ] **Step 4:** Run the e2e test and expect PASS. Look at screenshots of the editor and the piece sheet at iPhone size. Commit `feat(app): puzzle editor`.

### Task 5: Shared links

**Files:** Create `src/app/screens/SharedScreen.tsx`. Modify `src/app/router.ts` (route `#/s/:payload`), `src/app/App.tsx` and `src/app/screens/MyPuzzlesScreen.tsx` (a "Shared with me" section and a **Paste puzzle link** button).

**Behavior:**
- **Opening `#/s/:payload`:** decode it, and on a `LinkError` show its message with a Home button.
- **In Safari** (`display-mode` is not standalone): show the puzzle's name and a playable `PuzzleScreen` (progress kept on that page). Above it is **Add to my app**: tapping it copies the link and explains "Open Trainyard from your home screen, go to My puzzles, and tap Paste puzzle link."
- **In the installed app:** `addShared` runs straight away, and the screen opens the puzzle (`#/play/s-…`).
- **Paste puzzle link:** reads the clipboard on tap (`navigator.clipboard.readText`), accepts a full URL or a bare payload, and adds the puzzle, or shows the `LinkError` message.
- **Original puzzles are never accepted:** a payload whose code equals any loaded original level's code is refused with "That's one of the original puzzles."

- [ ] **Step 1: Write the failing tests:**
  - paste parsing accepts a URL or a payload and rejects junk;
  - an original code is refused (with stub collections);
  - opening the same link twice gives one entry (Review Focus 3).
- [ ] **Step 2:** Implement. Then write an e2e test:
  1. make a puzzle, solve it and share it (read the copied link through the test's clipboard permission);
  2. open the link in a new page and play it;
  3. paste it in the app and check it appears once in "Shared with me";
  4. open a damaged link and see the message.
- [ ] **Step 3:** Run `npm test`, `npm run e2e` and `npm run typecheck`, all green. Commit `feat(app): share puzzles by link`.

### Task 6: Release

- [ ] **Step 1:** Run a final whole-branch review (a fresh reviewer, on the most capable model) with this plan's Review Focus, then make one pass of fixes, each fix with a test that fails first.
- [ ] **Step 2:** Update `README.md`: making and sharing puzzles.
- [ ] **Step 3:** **Ask Scott**, then push and confirm the deploy.
