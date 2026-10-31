# Solver calibration

`npm run calibrate:solver` runs the solver (`src/solver/solve.ts`) on all 233 original puzzles with a budget of 1,000,000 layouts each. The results, per puzzle (slug, stars, status, segments, nodes, time; no puzzle codes), are in `fixtures/solver-calibration.json`. The run took about 40 minutes on a desktop.

These numbers were redone on 2026-10-30 after a rules fix: a puzzle is solved only once no trains remain. The first run counted 20 more originals as solved, because the solver found "solutions" that left a train behind. The puzzles still unsolved at the first run's budget were not rerun, since the stricter rule can only make them harder.

| Original stars | Puzzles | Solved | Median segments (quartiles) | Median nodes (quartiles) |
|---|---|---|---|---|
| 1–3★ | 66 | 54 (82%) | 11 (7–15) | 2,126 (106–27,534) |
| 4–8★ | 86 | 14 (16%) | 14 (13–15) | 51,704 (14,733–373,721) |
| 9–15★ | 72 | 1 (1%) | 14 | 684,197 |
| 16★+ | 9 | 0 | — | — |

**Quality:** where it finds a solution, the solver's track is about as short as the best trainyard.ca player's. The best player used fewer segments on only 5 of the 69 puzzles it solved. It is best-first, so solutions are short but not proven shortest.

**Reach:** most originals of 4★ and up are beyond a million-layout search. Those puzzles demand precise timing, merges and switch sequences that the search has to stumble on.

**Difficulty bands** (`src/solver/difficulty.ts`) follow from this:

- **Easy:** like a typical 1–3★ original (≥ 6 segments).
- **Medium:** like the harder half of 1–3★ (≥ 11 segments and ≥ 2,500 nodes).
- **Hard:** like the 4–8★ originals the solver can crack (≥ 13 segments and ≥ 25,000 nodes).
- **Very hard:** beyond the solver's phone budget of 300,000 nodes, where most 4★+ originals sit. The generator guarantees these are solvable by construction.
