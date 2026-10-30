# Trainyard

A personal web remake of Matt Rix's Trainyard, playable on an iPhone as an installable web app.

This repository contains only original code. The original game's puzzles, art and sounds are never committed. They are loaded on the device from an APK the player supplies.

## Install on an iPhone

1. Open https://sjbowden.github.io/trainyard/ in Safari.
2. Tap Share, then **Add to Home Screen**. Open it from the home screen from then on.
3. Save your Trainyard APK to Files or iCloud Drive, then tap **Load APK** and choose it. The puzzles are read on the phone and kept there. Nothing is uploaded.

It works offline after the first visit.

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
