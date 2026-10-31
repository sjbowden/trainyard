import { decodeBoard } from '../engine/codec.ts';
import { createRun } from '../engine/sim.ts';
import { MAX_HALF_STEPS } from './board/player.ts';
import type { Progress } from './progress.ts';

/**
 * True if this track fills every goal with nothing crashed but leaves trains behind. Before
 * 2026-10-30 the app counted that as solved; the original game never did.
 */
export function wonOnlyByOldRule(code: string): boolean {
  let run;
  try {
    run = createRun(decodeBoard(code));
  } catch {
    return false;
  }
  let filled = false;
  while (!run.ended && run.halfSteps < MAX_HALF_STEPS) {
    run.halfStep();
    if (run.outcome === 'won') return false;
    if (run.outcome !== 'crashed' && run.board.cells.every((c) => c.kind !== 'goal' || c.colors.length === 0)) filled = true;
  }
  return filled;
}

/**
 * The solved levels whose saved track only won under the old rule. The saved track is the
 * latest attempt, not necessarily the winning one, so a level is cleared only when that track
 * shows exactly the old mistake; a later attempt that crashes keeps its solve.
 */
export function solvesToClear(p: Progress, puzzleCode: (key: string) => string | undefined): string[] {
  return Object.entries(p.levels).flatMap(([key, l]) => {
    const code = l.solved ? puzzleCode(key) : undefined;
    return code !== undefined && wonOnlyByOldRule(`${code}_${l.solution}`) ? [key] : [];
  });
}

export function withSolvesCleared(p: Progress, keys: string[]): Progress {
  const levels = { ...p.levels };
  for (const key of keys) if (levels[key]) levels[key] = { ...levels[key], solved: false };
  return { levels };
}
