# Trainyard

A personal web remake of Matt Rix's Trainyard, playable on an iPhone as an installable web app.

This repository contains only original code. The original game's puzzles, art and sounds are never committed. They are loaded on the device from an APK the player supplies.

## Install on an iPhone

1. Open https://sjbowden.github.io/trainyard/ in Safari.
2. Tap Share, then **Add to Home Screen**. Open it from the home screen from then on.
3. Save your Trainyard APK to Files or iCloud Drive, then tap **Load APK** and choose it. The puzzles are read on the phone and kept there. Nothing is uploaded.

It works offline after the first visit.

## Making and sharing puzzles

Open **My puzzles** on the home screen and tap **New puzzle**. Tap a cell to place the selected piece, and tap a placed piece to set its sides and trains. **Test** plays the puzzle. Once you've solved it, **Share** sends a link. Changing a piece means solving it again before sharing.

A link opens in Safari, where the puzzle can be played straight away. **Add to my app** copies the link. In the installed app, go to **My puzzles** and tap **Paste puzzle link**. The whole puzzle is in the link; nothing is uploaded anywhere.

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
