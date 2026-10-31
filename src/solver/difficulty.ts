import type { SolveResult } from './solve.ts';

/** Difficulty levels for generated puzzles, graded by how hard the solver found them. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'veryHard';

export interface Band {
  minSegments: number;
  minNodes: number;
  /** The solver's node budget when grading for this band. */
  maxNodes: number;
  /** Whether a puzzle the solver couldn't crack in budget fits (it is solvable by construction). */
  acceptUnknown: boolean;
}

// Calibrated on the originals (docs/solver-calibration.md, 1M-node budget):
//   1–3★: 83% solved, median 11 segments / 2.4k nodes (quartiles 7–14 segments, 121–27k nodes)
//   4–8★: 29% solved, median 14 segments / 31k nodes; 9★+: mostly beyond the solver
export const BANDS: Record<Difficulty, Band> = {
  // like a typical 1–3★ original
  easy: { minSegments: 6, minNodes: 0, maxNodes: 30_000, acceptUnknown: false },
  // like the harder half of 1–3★
  medium: { minSegments: 11, minNodes: 2_500, maxNodes: 60_000, acceptUnknown: false },
  // like the 4–8★ originals the solver can crack
  hard: { minSegments: 13, minNodes: 25_000, maxNodes: 150_000, acceptUnknown: false },
  // beyond the solver's phone budget, like most 4★+ originals (solvable by construction)
  veryHard: { minSegments: 14, minNodes: 250_000, maxNodes: 300_000, acceptUnknown: true },
};

const ORDER: Difficulty[] = ['veryHard', 'hard', 'medium', 'easy'];

/** The hardest band a solver result meets, or 'tooEasy'. */
export function grade(result: SolveResult): Difficulty | 'tooEasy' {
  if (result.status === 'unknown') return 'veryHard';
  return ORDER.find((d) => result.segments >= BANDS[d].minSegments && result.nodes >= BANDS[d].minNodes) ?? 'tooEasy';
}
