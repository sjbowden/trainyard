# CLAUDE.md

Personal web remake of Trainyard for Scott's iPhone. Design: `docs/superpowers/specs/2026-10-29-trainyard-design.md`. Plans: `docs/superpowers/plans/`.

## Never commit or publish
- `*.apk`, anything extracted from it (`local/`), the decompiled ActionScript from `BlueprintViewer.swf`, or original puzzle codes.
- The original's art and sounds: the atlas PNG, crops or screenshots of it, and `.ogg` files. Frame rectangles and names (`src/app/theme/original/frames.ts`) are fine.
- The scraped player-made puzzles (`local/library-raw.json`) and the library file built from them (`local/trainyard-library.json`).
- `fixtures/solutions.json` holds solution halves only (the text after `_`), keyed by level slug.

## Commands
- `npm test`: Vitest. APK and accuracy suites skip when `local/` or an APK is absent (as in CI).
- `npm run typecheck`
- `npm run extract`: APK in the repo root → `local/collections.json`
- `npm run scrape:fixtures`: trainyard.ca solutions → `fixtures/solutions.json` (slow, polite)
- `npm run library:build`: `local/library-raw.json` → `local/trainyard-library.json`, the file loaded onto the phone
- `npm run e2e`: end-to-end smoke test (Chromium, iPhone emulation; needs an APK)

## Before every push to main
Pushing deploys the site. Run `npm test` locally first, with the APK present, so the accuracy suite (1,667 real solutions) runs. CI and the Pages workflow can't run it.

## Conventions
- American English everywhere (color, center).
- Git identity is repo-local: Scott Bowden <sjbowden@gmail.com>. Never the work email.
- To show Scott a `.md` file, open it in Windows: `explorer.exe "$(wslpath -w <file>)"`. Don't hand him clickable paths.
