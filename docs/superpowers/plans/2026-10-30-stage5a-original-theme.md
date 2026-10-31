# Stage 5a: The Original Theme, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** after loading the APK, Scott can switch the board to the original game's art and sounds in Settings.

**Architecture:**
- **Loading:** when the APK is loaded, the app now also keeps two things from it on the phone, in IndexedDB: the board art (`assets/FullAtlasHD.png`) and the sounds (`assets/audio/*.ogg`).
- **The theme:** a second `Theme` (the interface in `src/app/theme/theme.ts`) draws atlas frames with `drawImage` and plays the decoded sounds.
- **Choosing:** Settings chooses the theme. The app loads the chosen theme once and passes it to every board.
- **The frame map:** the atlas's own index (`FullAtlasHD.atl`, `FullAtlas.m`) does **not** match the image in either APK, so the frame rectangles are mapped by hand. They are kept in the repo as numbers only; the art itself never is.

**Tech Stack:** as before. `pngjs` is added as a dev dependency, for the dev-only atlas tool.

**Spec:** `docs/superpowers/specs/2026-10-29-trainyard-design.md`, Goal 5 and the "Default theme" call. Stage 5b, the player-made puzzle library, waits until trainyard.ca answers again.

## Global Constraints

- **Never commit or publish the art or sounds.** That covers the atlas PNG, crops of it, and the `.ogg` files. Dev output goes in `local/`, which is git-ignored. Frame rectangles and frame names may be committed.
- **The default theme stays the default.** It stays the only theme when no APK assets are stored, and the app must never break for lack of the Original theme.
- **Rules come only from `src/engine`.** A theme draws and plays sounds. It decides nothing about play.
- **iOS:** sound plays only after a tap (`unlockAudio`, already in place). Any sound that fails to decode falls back to the default theme's synthesized sound for that kind.
- American English. Scott's phone runs iOS 27.0.1.
- **The release asks Scott first,** with screenshots of the theme. This is a visible change, not a small fix.

## What the atlas holds (from the APK, 2026-10-30)

`FullAtlasHD.png` is 2048×2048. The Express APK's copy is byte-identical. The frame names in the `.atl` are trustworthy, even though its coordinates are not. They tell us what to look for:

| Frames | Count | Likely meaning (confirm by eye in Task 1) |
|---|---|---|
| `Empty`, `StationFloor_0..7` | 1, 8 | Board floor tile; floor under stations |
| `Track_0..6` | 7 | Rail art per segment (the `.atl` order may follow `Segment` 0–6) |
| `OutletStation`, `GoalStation`, `GoalStation_completed` | 3 | Station bodies |
| `OutletNub{1,4,9,16}_0..6`, `GoalNub{1,4,9,16}_0..6` | 56 | Per-train icons inside a station, colored 0–6, sized for 1, ≤4, ≤9 or ≤16 trains (1×1, 2×2, 3×3, 4×4 grids) |
| `Train_0..7` | 8 | Train sprite per color (34×60, nose up) |
| `PainterStation`, `PainterStationColoredParts_0..9`, `PainterText_0..6` | 18 | Painter body, its colored overlay, its letter (R, Y, B, O, G, P, …) |
| `SplitterStation_0..4` | 5 | Splitter body and overlays (the scissors icon) |
| `RockStation` | 1 | Rock |

The game frames sit mostly in the atlas's lower-right quarter; most of the rest is UI buttons, which we don't need. Station side openings (the nubs where trains enter or leave) are part of the reconstruction: we draw them from frames or with canvas strokes, whichever matches better.

Sounds (`assets/audio/`) map onto our `SoundKind`s:

| SoundKind | File |
|---|---|
| `draw` | `Game_DrawTrack.ogg` |
| `erase` | `Game_EraseTrack.ogg` |
| `switch` | `Game_SwitchTrack.ogg` |
| `paint` | `Game_Paint.ogg` |
| `split` | `Game_Splitter.ogg` |
| `crash` | `Game_Crash.ogg` |
| `deliver` (color c) | `Game_Train_{c+1}.ogg` |
| `start` | `UI_StartGame.ogg` |
| `win` | `GameUI_Win.ogg` |

## Review Focus

- **No assets stored, Original chosen.** This happens after "Load a different APK" fails, or when a phone cleared site data. The app must show the default theme and say why in Settings, never a blank board.
- **Loaded the APK before this release.** Scott's phone has the puzzles but not the art. Settings must offer "Load the APK again to add the Original theme".
- **A sound fails to decode on iOS.** That kind falls back to its synthesized sound. Nothing throws.
- **Stations with many trains,** up to 16 in an outlet or goal. Icons must use the right grid and stay inside the cell.
- **Switches and secondary segments.** The inactive segment must look distinct, as in the default theme, or switch puzzles become unreadable.

---

### Task 1: The frame map

**Files:**
- Create: `scripts/atlas-sheet.ts` (dev only, reads the APK)
- Create: `src/app/theme/original/frames.ts`
- Test: `tests/app/originalFrames.test.ts`
- Modify: `package.json` (add the `pngjs` and `@types/pngjs` dev dependencies, and the `"atlas:sheet": "tsx scripts/atlas-sheet.ts"` script)

**Interfaces:**
- Produces:
  - `export interface Frame { x: number; y: number; w: number; h: number }`
  - `export const FRAMES: Record<FrameName, Frame>`
  - `export type FrameName` (the names below)
  - `export const ATLAS_SIZE = 2048`

- [ ] **Step 1: Write `scripts/atlas-sheet.ts`.** It unzips `FullAtlasHD.png` from the APK in the repo root with fflate. It finds sprites as connected regions of alpha > 0, merging regions closer than 2 px, and writes `local/atlas-sheet.png`: the atlas with each region outlined and numbered, plus `local/atlas-regions.json` (id → x, y, w, h). Run `npm run atlas:sheet`.
- [ ] **Step 2: Label the regions by eye, and write `frames.ts`.** Use these names:
  - `floor`
  - `stationFloor`
  - `track1`–`track6` (by `Segment` value)
  - `outlet`, `goal`, `goalDone`
  - `outletNub{1,4,9,16}_{0-6}`, `goalNub{1,4,9,16}_{0-6}`
  - `train0`–`train6`
  - `painter`, `painterPart{0-6}`, `painterText{0-6}`
  - `splitter`
  - `rock`

  Where the `.atl` size (for example 92×92 for a tile, 34×60 for a train) matches a region, that confirms the label. Record any frame that can't be found in the file's header comment; Task 3 draws it with canvas instead.
- [ ] **Step 3: Write the test.**

```ts
test('every frame lies inside the atlas', () => {
  for (const [name, f] of Object.entries(FRAMES)) {
    expect(f.x >= 0 && f.y >= 0 && f.x + f.w <= ATLAS_SIZE && f.y + f.h <= ATLAS_SIZE, name).toBe(true);
  }
});
test('tiles are square and trains are tall', () => {
  expect(FRAMES.floor.w).toBe(FRAMES.floor.h);
  expect(FRAMES.train0.h).toBeGreaterThan(FRAMES.train0.w);
});
```
- [ ] **Step 4: Run `npx vitest run tests/app/originalFrames.test.ts`.** Expect PASS. Check that `git status` shows nothing under `local/`.
- [ ] **Step 5: Commit** with the message `feat(theme): map the original atlas frames by hand`.

### Task 2: Keep the art and sounds when the APK is loaded

**Files:**
- Modify: `src/data/apk.ts`
- Modify: `src/app/store.ts`
- Test: `tests/data/apk.test.ts`, `tests/app/store.test.ts`

**Interfaces:**
- Produces:
  - In `apk.ts`: `export interface ThemeAssets { atlas: Uint8Array; sounds: Record<string, Uint8Array> }`, keyed by file name without `.ogg`.
  - In `apk.ts`: `export function readThemeAssets(bytes: Uint8Array): ThemeAssets | null`. It returns null if the atlas is missing.
  - In `store.ts`: `importApk` also stores the assets under `'theme/original/v1'`, as `{ atlas: Blob; sounds: Record<string, Blob> }`. Its result gains `themeSaved: boolean`.
  - In `store.ts`: `export async function loadThemeAssets(): Promise<{ atlas: Blob; sounds: Record<string, Blob> } | null>`.

- [ ] **Step 1: Write the failing tests.**
  - With the APK present (skip when it's absent): `readThemeAssets` returns an atlas starting with the PNG signature `89 50 4E 47`, and `Object.keys(sounds)` contains `Game_Crash` and `Game_Train_7`.
  - On a zip without the atlas, it returns `null`.
  - In the store (fake-indexeddb): after `importApk`, `loadThemeAssets()` returns an atlas Blob of type `image/png`.
  - In the store: `loadThemeAssets()` returns `null` when nothing is stored.
- [ ] **Step 2: Run them.** Expect FAIL.
- [ ] **Step 3: Implement.**
  - `readThemeAssets` makes its own `unzipSync` pass with a filter on `assets/FullAtlasHD.png` and `assets/audio/*.ogg`.
  - `importApk` stores the assets after the collections. A failure there sets `themeSaved: false` but still returns the puzzles.
  - The Blobs get types `image/png` and `audio/ogg`.
- [ ] **Step 4: Run `npm test`.** Expect PASS.
- [ ] **Step 5: Commit** with the message `feat(data): keep the original art and sounds from the APK`.

### Task 3: Draw the board in the Original theme

**Files:**
- Create: `src/app/theme/original/draw.ts`
- Test: `tests/app/originalTheme.test.ts`

**Interfaces:**
- Consumes: `FRAMES` (Task 1), and `Theme` and `Layout` from the existing code.
- Produces: `export function originalDrawing(atlas: CanvasImageSource): Pick<Theme, 'drawFloor' | 'drawPiece' | 'drawTrain' | 'drawEffect'>`

- [ ] **Step 1: Write the failing tests.** Use a fake 2D context that records `drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh)` calls.
  - An `empty` cell draws nothing beyond the floor, and `drawFloor` draws `FRAMES.floor` once per cell.
  - A track cell with a primary segment draws the `track{primary}` frame. With a secondary segment it draws both, the secondary at `globalAlpha` < 1. Assert the `globalAlpha` at the time of each call.
  - An outlet with 3 trains draws `outlet` and three `outletNub4_*` frames, in its colors and order. With 1 train it uses `outletNub1_*`. With 10 trains it uses `outletNub16_*`, and every destination rectangle stays inside the cell.
  - A goal whose `colors` is empty draws `goalDone`.
  - `drawTrain` draws `train{color}` centered on (x, y), rotated by `angle + π/2` (the sprite's nose is up). Assert via a recorded `rotate` call.
- [ ] **Step 2: Run them.** Expect FAIL.
- [ ] **Step 3: Implement `originalDrawing`.**
  - Each frame is scaled to the cell size. Nub grids are 1×1, 2×2, 3×3 or 4×4, laid out row-major inside the station's inner area.
  - Painters stack `painter`, `painterPart{color}` and `painterText{color}`, rotated for vertical painters.
  - Splitters draw `splitter`, rotated so its entry side matches `piece.in`.
  - Side openings for outlets and goals, and `drawEffect`: reuse the default theme's canvas code where no frame fits. Import its helpers; don't copy them.
- [ ] **Step 4: Run `npx vitest run tests/app/originalTheme.test.ts`.** Expect PASS.
- [ ] **Step 5: Check by eye.** Use a throwaway Playwright script, not committed, that renders Red Line and three busier originals into `local/theme-*.png`. Look for frames that are misaligned or mislabeled, and fix them in `frames.ts`. The originals: one with switches, one with a splitter and painter, and one with a 9+ train goal.
- [ ] **Step 6: Commit** with the message `feat(theme): draw the board with the original art`.

### Task 4: Original sounds

**Files:**
- Create: `src/app/theme/original/sounds.ts`
- Modify: `src/app/theme/sound.ts` (export the shared `AudioContext` getter)
- Test: `tests/app/originalSounds.test.ts`

**Interfaces:**
- Produces:
  - `export const SOUND_FILES: Record<Exclude<SoundKind, 'deliver'>, string>`, plus `deliverFile(color: Color): string`. The values are as in the table above.
  - `export async function decodeSounds(blobs: Record<string, Blob>, decode: (b: ArrayBuffer) => Promise<AudioBuffer>): Promise<Record<string, AudioBuffer>>`. It skips files that fail to decode.
  - `export function originalPlayer(buffers: Record<string, AudioBuffer>): (kind: SoundKind, color?: Color) => void`. It plays the buffer when present, and otherwise calls `synthSound(kind, color)`.
  - In `sound.ts`: `export function audioContext(): AudioContext | null`.

- [ ] **Step 1: Write the failing tests.**
  - `decodeSounds` with one blob whose `decode` rejects returns the others, without throwing.
  - `originalPlayer({})('crash')` calls the (mocked) `synthSound('crash')`.
  - `deliverFile(6)` is `'Game_Train_7'`.
- [ ] **Step 2: Run them.** Expect FAIL.
- [ ] **Step 3: Implement.** Playing a buffer creates an `AudioBufferSourceNode` on `audioContext()` and does nothing while the context is null.
- [ ] **Step 4: Run them.** Expect PASS.
- [ ] **Step 5: Commit** with the message `feat(theme): the original sounds, falling back to synthesized ones`.

### Task 5: Choose the theme in Settings

**Files:**
- Create: `src/app/theme/original/index.ts` (`loadOriginalTheme`)
- Modify:
  - `src/app/settings.ts` (`theme: 'default' | 'original'`, default `'default'`)
  - `src/app/screens/SettingsScreen.tsx`
  - `src/app/App.tsx` (hold the active theme and pass it on)
  - `src/app/screens/EditorScreen.tsx` (take a `theme` prop instead of importing `defaultTheme`)
- Test: `tests/app/screens.test.tsx`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces:
  - `export async function loadOriginalTheme(): Promise<Theme | null>`. It reads `loadThemeAssets()`, then makes the atlas with `createImageBitmap`, decodes the sounds, and builds the theme. It returns null on any failure.
  - Settings gains a "Board style" row with **Default** and **Original** options.
  - App switches theme as soon as Settings changes it, with no reload.

- [ ] **Step 1: Write the failing tests.**
  - With no theme assets stored, Settings shows Original as disabled, with the hint "Load the APK again to add the original art and sounds" linking to `#/load`.
  - With assets stored (test the Settings component with a `hasOriginal` prop), choosing Original saves `theme: 'original'`.
  - App with `theme: 'original'` saved but no assets renders the default theme. A unit test asserts that `loadOriginalTheme()` resolves null, and that App falls back.
  - e2e: load the APK, open Settings, choose Original, then open Red Line and Start. The puzzle still wins, and there are no console errors.
- [ ] **Step 2: Run them.** Expect FAIL.
- [ ] **Step 3: Implement.** Pass the theme to:
  - App's `Puzzle`, `play`, `shared` and `edit` routes;
  - `TutorialOverlay`;
  - `EditorScreen`.

  After `LoadApkScreen` finishes, reload the Original theme if it is the chosen one.
- [ ] **Step 4: Run `npm run typecheck`, `npm test` and `npm run e2e`.** Expect all green.
- [ ] **Step 5: Commit** with the message `feat(app): choose the board style in Settings`.

### Task 6: Release

- [ ] **Step 1: Update the docs.** Add a "Themes" section to `README.md`: what the Original theme is, that it needs the APK, and that the art never leaves the phone. In `CLAUDE.md`, add atlas crops and audio to the never-commit list.
- [ ] **Step 2: Run the full suite.** Run `npm test` with the APK present, then `npm run e2e`. Run `git status` and `git ls-files | grep -iE '\.(ogg|png)$'`, and check that no new art is tracked: only the existing app icons.
- [ ] **Step 3: Show Scott.** Take phone-size screenshots of Red Line and two busier puzzles in both themes, and save them under `local/`. Show them, and ask before pushing.
- [ ] **Step 4: Push and confirm.** After Scott says yes, push with the personal-account command and confirm the Pages deploy.
