# Trainyard

A personal web remake of Matt Rix's Trainyard, playable on an iPhone as an installable web app.

This repository contains only original code. The original game's puzzles, art and sounds are never committed. They are loaded on the device from an APK the player supplies.

- Design: `docs/superpowers/specs/2026-10-29-trainyard-design.md`
- Rules: `docs/rules.md`

```bash
npm test             # unit tests (APK-dependent suites skip when no APK is present)
npm run typecheck
npm run extract      # dev only: read an APK in the repo root into local/collections.json
```
