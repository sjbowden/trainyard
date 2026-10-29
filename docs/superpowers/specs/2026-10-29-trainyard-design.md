# Trainyard web remake: design

Date: 2026-10-29. Owner: Scott Bowden (personal project).

## Intent

Scott loved Trainyard (Matt Rix, 2010). It no longer runs on iOS. He wants it back on his iPhone, for himself. **The point is the puzzle solving.** Success means the original puzzles play exactly as they did, plus a steady supply of new ones: puzzles he or other people design, and fresh puzzles the app makes up.

## Goals

1. All 233 original puzzles play with the original rules, grouped into their cities, with the original star values and city unlock thresholds.
2. The app plays well on an iPhone. It installs to the home screen, opens full screen, and works offline.
3. A puzzle editor. A finished puzzle can be shared as a link that contains the whole puzzle. Opening a link adds the puzzle to the recipient's app.
4. A puzzle generator. The player picks a difficulty and gets a new board, already checked to be solvable and not trivial.
5. A swappable theme. All art, colors and sounds come from one theme pack, and changing theme is a setting.

6. A curated library of the best puzzles players made in the original's editor (from trainyard.ca), playable in the app.

## Non-goals

- Accounts, a server, leaderboards, a public puzzle gallery, or syncing between devices. Progress lives on the phone.
- Android, desktop or tablet layouts as targets. They may work, but the iPhone in portrait is the design point.
- A native App Store app.
- Matching the original's menus and transitions screen for screen. The puzzles and rules must match, the surrounding UI need not.

## Anti-goals (a failure even if it works)

- **Any rule differing from the original**, so that an original puzzle solves differently or a known solution fails. Rule accuracy outranks everything else.
- **Clumsy track drawing on a phone.** Solving is the point, so drawing, erasing and switch-flipping must feel as direct as the original.
- **Publishing the original game's content.** The public site must contain no original puzzle data, art or sound.
- **Generated puzzles that can't be solved, or are trivial.**

## Constraints and decisions made

- **Platform:** a static web app (a PWA) hosted on GitHub Pages. HTTPS, a manifest and a service worker let it install to the iPhone home screen and run offline.
- **Original content comes from the APK, on the device.** Scott has `trainyard-express-1-5-3-en-android.apk` (in the repo folder; must never be committed or published). The player opens the APK file in the app once, through a file picker. The app then unzips it in the browser and reads the puzzle databases and the art and sound assets, and stores them on the phone (IndexedDB). Without the APK, the app still works, with the fresh default theme, the editor, the generator and shared puzzles.
- **Two APKs are available** in the project folder (never committed): the full game `android-comnoodlecaketrainyard-0.apk` and `trainyard-express-1-5-3-en-android.apk`. Their `trainyardStatic.db` files are byte-identical, so either one supplies all 233 puzzles. Prefer the full-game APK for the Original theme's art and sound, and accept either.
- **User-made puzzle library (curated; Scott chose curated over all 162,528):** scraped once in development into a data file. Like the APK content it stays out of the public site, and the player loads it onto the phone once (Files app picker). Each entry keeps name, creator, wrenches, likes and solve count, and creator credit is shown in the app.
- **Sharing is by link.** The puzzle is encoded in the URL fragment. Shared puzzles work for anyone, whether or not they have loaded the APK.
- **Links open in Safari, not the installed app (iOS keeps their storage separate). Scott agreed to this flow:** the link opens a Safari page where the puzzle can be played at once, with an "Add to my app" button. The button copies the puzzle (clipboard). The installed app offers to add it the next time it opens. A paste/import screen inside the app is the fallback.
- **Default theme:** a fresh look of our own, safe to publish. An "Original" theme becomes available once the APK has been loaded. Using the original art and sound for Scott's own use is the designer's call, which Scott accepted.
- **Generator:** runs on the phone using the app's own solver, so it is offline and free. AI generation is an optional extra, not required. Themed sets (e.g. "built around splitters") are a bonus, not required.

## What we know about the source data (recon, 2026-10-29)

### The APK (`assets/` inside the zip)

| File | Contents |
|------|----------|
| `trainyardStatic.db` (SQLite) | `worlds` (23 cities: slug, name, `starsToUnlock`, `groupID` 0 = main / 1 = bonus, ordinal) and `levels` (165 puzzles: slug, worldSlug, name, `stars`, `puzzle` code, ordinal). `tutorials` (8, XML scripts) |
| `trainyardExpressStatic.db` | The same schema: 13 provinces/territories, 68 puzzles, 7 tutorials |
| `trainyardLive.db`, `trainyardEngineer.db` | Empty templates for the original's saved solutions (`blueprints.solution`, `trackCount`, `stepCount`) and user puzzles (`puzzleString`, `solutionString`). Useful as a hint to the format |
| `FullAtlas.png` / `FullAtlasHD.png` + `.atl`/`.h`/`.m` | Sprite atlas with frame coordinates |
| `audio/*.ogg` | Sound effects (track draw/erase, switch, paint, splitter, crash, win, train loops, UI) |
| `tutorials.xml`, fonts, splash screens | Tutorial scripts and the remaining art |
| `lib/armeabi/libgame.so` | Native game logic (ARM). The authoritative rules, but costly to read |

Star values for puzzles run from 1 to 30. Solving a puzzle earns its stars, and a city unlocks when the player's total reaches its `starsToUnlock` (e.g. Brampton 6, Niagara Falls 375, Whitehorse 1119).

Note: iOS Safari does not play `.ogg` reliably. Theme sounds may need decoding to PCM via the Web Audio API in the app, or another route. This is the builder's call.

### The puzzle code

Each puzzle is a short string, e.g. Red Line = `hh002Oja3Giaa00`, Kes = `hhGeah2Geaa2Geao04PcoPaoPaoPaoPaoPaoPbo04GbahOaJOaJOaJOaJOaJGbao`. **The format is undocumented and must be decoded.** Aids:

- **The tutorials describe their boards in plain words.** E.g. `welcome` resets to `hh002OjC3GiaC00` and says there is a green outlet at col,row 1,3 and a goal at 5,3. Its tutorial steps also script the drawn track (`hand_moveTo cr=...`). Those are known answers to test the decoder against.
- **trainyard.ca solution pages** hold the puzzle code plus the player's track. E.g. `https://trainyard.ca/3` (Red Line's best solution) has `ys:"hh002Oja3Giaa00_003QQQ00"`: the puzzle code, `_`, then a track code. A public JSON feed lists the solutions for each puzzle: `https://trainyard.ca/system/pages/data/getItemsAsJSON.php?filterType=economical&filterData=&resultType=blueprintsForLevel&extraData=<levelSlug>&pageIndex=1&itemsPerPage=N`. It returns `encodedID` (solution page path), `trackCount` (encoded as major*1000+minor) and `stepCount`. Each solution page also links a large PNG of the solved board (`/system/content/images/blueprintsByID/png/<id>_large.png`).
- **The Flash `BlueprintViewer.swf`** (`https://trainyard.ca/system/flash/BlueprintViewer.swf`, compressed SWF, ~250 KB, downloaded during recon) decodes the codes and animates the solution. Its ActionScript can be decompiled (e.g. with JPEXS FFDec), and it is the most practical reference for **both the code format and the simulation rules**. It is a better reference than `libgame.so`.

**User-made puzzles on trainyard.ca:** the feed `getItemsAsJSON.php?filterType=<mostLikes|mostSolved|newest|...>&filterData=&resultType=epuzzles&extraData=&pageIndex=N&itemsPerPage=100` (100 per page maximum) lists puzzles (`id`, `encodedID`, `name`, `wrenches` 1–30, `creatorName`, `solutionCount`, `views`, `likes`). The featured list is the HTML page `/puzzles/featured` (28 puzzles in 4 sets, links `/P<code>`). A puzzle page has no layout, only an image. To get the layout, fetch one solution: `resultType=eblueprintsForPuzzle&extraData=<id>&filterType=economical&itemsPerPage=1`. Then open the solution page `/<encodedID>`, whose `ys:` flashvar starts with the puzzle code, before the `_`. Puzzles with no solution can't be recovered, so skip them. Scrape politely: one request at a time, with a delay of about 0.5 s or more.

**Fixture set:** use, for many original puzzles, several known solutions from trainyard.ca. Each solution is a known-good test of the decoder and the simulator: it must solve in exactly `stepCount` steps, with its `trackCount`. Scrape them once in development and keep them as test fixtures in the repo. They are user solutions, not original game content, but keep their puzzle codes out of the public build anyway. Store only the solution half, keyed by level slug, and join it to the APK data in tests.

## Game rules (as remembered; confirm against the SWF and the fixtures)

- 7×7 board. Fixed pieces: **outlets** (emit a listed sequence of colored trains, one per release, out of one side), **goals** (accept trains on one or more marked sides and need a listed set of colors; a goal is satisfied when every listed train has arrived), **rocks**, **painters** (repaint a passing train; straight through, fixed orientation), and **splitters** (a train entering splits into two trains leaving the two perpendicular sides).
- Colors: red, yellow, blue; orange = red+yellow, green = yellow+blue, purple = red+blue; any other mix = brown. Splitting a secondary color gives its two primaries. Splitting a primary or brown gives two of the same color.
- Player track: each empty tile holds up to two track segments, each joining two sides. Two segments sharing a side form a **switch**. Only one is active, a tap toggles it before the run, and it flips each time a train passes through.
- Trains meeting merge and mix color: two trains entering a tile together combine; trains passing each other head-on on an edge mix but keep their directions; trains crossing on a "+" mix and continue.
- Crashes: leaving track, hitting a rock or an outlet, entering a goal by a wrong side, a goal receiving a color it doesn't need (or more than needed), or a train being left over. A crash fails the run.
- Win: every outlet empty, every goal satisfied, no crash.
- Track count shown as `major+minor` (the trainyard.ca format). The exact meaning must come from the SWF.

## Player experience

- **Home:** Trainyard and Express as two collections (only after the APK is loaded), plus "My puzzles", "Shared with me" and "Generate". City list with stars and lock state.
- **Puzzle screen:** the board fills the width in portrait. Draw track by dragging a finger across tiles, as in the original (enter a tile by one side and leave by another to lay that segment). Erase mode, tap a tile to toggle its switch, undo/redo, clear, then Start/Stop and a speed control. Win and crash feedback. The player's solution is saved per puzzle.
- **Tutorials:** the original tutorial scripts are available with the APK. Without them, a short built-in how-to.
- **Editor:** place and rotate pieces, set outlet and goal color lists. A puzzle can't be shared until the editor proves it solvable, either because the author solved it or because the solver found a solution. Sharing gives a link. Adding the puzzle from that link (see the Safari flow above) puts it in "Shared with me".
- **Generator:** choose a difficulty (e.g. easy, medium, hard, very hard), get a board the solver has confirmed solvable and non-trivial, and play it. Generated puzzles can be kept and shared like any other.

## Designer's calls (settled after review; Scott may override)

- **What "curated" means:** the 28 featured puzzles, in their four sets (Port Credit, Lorne Park, Cooksville, Erindale), plus the union of the top 2,000 by likes and the top 2,000 by solve count. That's roughly 3,000 puzzles. The app browses them by featured set, then by wrenches, with sorting by likes or solves. The list can be widened later by re-running the scraper.

- **Tutorials:** with the APK, show each tutorial step's text over its starting board (`yard_reset`), with Next/Back. Do not build the animated-hand script interpreter. It can come later if wanted.
- **Originals stay out of the editor and links:** the editor cannot open or copy an APK puzzle, and new-puzzle links use our own format, distinct from the original codes. This keeps original data off Scott's phone except where the APK put it.
- **Repo and CI:** the repo lives on Scott's personal GitHub account `sjbowden` (where his other personal projects live, under `~/personal/`; not the work account `scottjbowden`). It is public, since free GitHub Pages needs a public repo. Commits use Scott's personal email (sjbowden@gmail.com), set in this repo's git config only, never the work email. The decoder and the scraped solution halves may be public. They are our code and players' public solutions. CI runs only tests that don't need the APK. The accuracy fixture tests run locally against the APK and must pass before every deploy.
- **Progress:** Trainyard and Express keep separate star totals, as in the original apps.

## Left to the builder

- Front-end stack, rendering (canvas or SVG), and the build tooling. Keep it a plain static site with no backend.
- Decoding approach, so long as it is proven against the tutorial and trainyard.ca fixtures.
- The solver's algorithm, and how "difficulty" and "non-trivial" are measured (e.g. minimum track count, number of switches/merges, solver search effort, fixture-calibrated against original star values).
- The puzzle link format for new puzzles. Reusing the original code format is welcome if decoded.
- The look of the default theme, and the shape of the theme pack.
- How the Original theme maps atlas frames, and how `.ogg` sound is played on iOS.
- Git setup and the GitHub Pages deploy. `.gitignore` must exclude `*.apk`, extracted assets and scraped puzzle codes.
