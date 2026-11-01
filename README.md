# Trainyard

A personal web remake of Matt Rix's Trainyard, playable on an iPhone as an installable web app.

This repository contains only original code. The original game's puzzles, art and sounds are never committed. They are loaded on the device from an APK the player supplies.

## Install on an iPhone

1. Open https://sjbowden.github.io/trainyard/ in Safari.
2. Tap Share, then **Add to Home Screen**. Open it from the home screen from then on.
3. Save your Trainyard APK to Files or iCloud Drive, then tap **Load APK** and choose it. The puzzles are read on the phone and kept there. Nothing is uploaded.

It works offline after the first visit.

## Fresh puzzles

Tap **New puzzle for me** and pick Easy, Medium, Hard or Very hard. The app builds a puzzle backwards from a working answer, so every one can be solved, and a solver grades it against levels calibrated on the original puzzles (`docs/solver-calibration.md`). Generated puzzles are kept under **Generated** in My puzzles and can be shared.

## Making and sharing puzzles

Open **My puzzles** on the home screen and tap **New puzzle**. Tap a cell to place the selected piece, and tap a placed piece to set its sides and trains. **Test** plays the puzzle. Once you've solved it, or the solver (🤖) has, **Share** sends a link. Changing a piece means solving it again before sharing.

A link opens in Safari, where the puzzle can be played straight away. **Add to my app** copies the link. In the installed app, go to **My puzzles** and tap **Paste puzzle link**. The whole puzzle is in the link; nothing is uploaded anywhere.

## Board style

**Settings → Board style** switches between the default look and **Original**, the original game's art and sounds. They come from your APK when you load it, and are kept on the phone like the puzzles. If you loaded the APK before this option existed, load it once more. Any sound the phone can't play falls back to the default one.

## Player puzzle library

The best puzzles players made in the original's editor, from trainyard.ca: the 28 featured puzzles in their four sets, and about 2,750 more grouped by difficulty in wrenches. Like the APK, the library never goes on the public site; you make the file on your computer and load it onto the phone once.

1. `npm run scrape:library` (slow and polite; already done once, resumes) collects them into `local/library-raw.json`.
2. `npm run library:build` writes `local/trainyard-library.json`. Save it to iCloud Drive.
3. On the phone: Home → Player puzzles → Choose library file. Each puzzle credits its creator.

## Moving progress between devices

Each device keeps its own progress. To carry it over: **Settings → Save progress** on one device and choose Save to Files (iCloud Drive), then **Settings → Load progress** on the other. Loading merges rather than replaces: a puzzle solved on either device counts as solved, and each puzzle keeps the track laid most recently. It covers the original puzzles and the player library, not your own puzzles.

## Development

- Design: `docs/superpowers/specs/2026-10-29-trainyard-design.md`
- Rules: `docs/rules.md`

```bash
npm test             # unit tests (APK-dependent suites skip when no APK is present)
npm run typecheck
npm run extract      # dev only: read an APK in the repo root into local/collections.json
npm run dev          # http://localhost:5173/trainyard/ (add ?dev=<levelSlug> to open an original puzzle)
npm run build        # static site in dist/
npm run e2e          # end-to-end smoke test (needs an APK in the repo root)
```
