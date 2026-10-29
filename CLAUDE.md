# CLAUDE.md

Personal web remake of Trainyard for Scott's iPhone. Design: `docs/superpowers/specs/2026-10-29-trainyard-design.md`. Plans: `docs/superpowers/plans/`.

## Never commit or publish
- `*.apk`, anything extracted from it (`local/`), the decompiled ActionScript from `BlueprintViewer.swf`, or original puzzle codes.
- `fixtures/solutions.json` holds solution halves only (the text after `_`), keyed by level slug.

## Commands
- `npm test`: Vitest. APK and accuracy suites skip when `local/` or an APK is absent (as in CI).
- `npm run typecheck`
- `npm run extract`: APK in the repo root → `local/collections.json`
- `npm run scrape:fixtures`: trainyard.ca solutions → `fixtures/solutions.json` (slow, polite)

## Conventions
- American English everywhere (color, center).
- Git identity is repo-local: Scott Bowden <sjbowden@gmail.com>. Never the work email.
- To show Scott a `.md` file, open it in Windows: `explorer.exe "$(wslpath -w <file>)"`. Don't hand him clickable paths.
