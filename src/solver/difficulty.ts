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

// Starting values from the Stage 4 plan; replaced by calibration against the originals (docs/solver-calibration.md).
export const BANDS: Record<Difficulty, Band> = {
  easy: { minSegments: 6, minNodes: 0, maxNodes: 20_000, acceptUnknown: false },
  medium: { minSegments: 10, minNodes: 2_000, maxNodes: 60_000, acceptUnknown: false },
  hard: { minSegments: 14, minNodes: 20_000, maxNodes: 150_000, acceptUnknown: false },
  veryHard: { minSegments: 18, minNodes: 200_000, maxNodes: 300_000, acceptUnknown: true },
};

const ORDER: Difficulty[] = ['veryHard', 'hard', 'medium', 'easy'];

/** The hardest band a solver result meets, or 'tooEasy'. */
export function grade(result: SolveResult): Difficulty | 'tooEasy' {
  if (result.status === 'unknown') return 'veryHard';
  return ORDER.find((d) => result.segments >= BANDS[d].minSegments && result.nodes >= BANDS[d].minNodes) ?? 'tooEasy';
}
