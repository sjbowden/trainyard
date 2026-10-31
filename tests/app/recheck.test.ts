import { expect, test } from 'vitest';
import { emptyProgress, recordAttempt } from '../../src/app/progress.ts';
import { solvesToClear, withSolvesCleared } from '../../src/app/recheck.ts';
import { encodeBoard, splitCode } from '../../src/engine/codec.ts';
import { COLOR, SEGMENT, SIDE } from '../../src/engine/types.ts';
import { board, goal, outlet, track } from '../engine/helpers.ts';

const { R, L } = SIDE;
const { red, blue } = COLOR;
const { LR } = SEGMENT;

const parts = (b: ReturnType<typeof board>) => splitCode(encodeBoard(b));

// each puzzle comes with its saved track
const puzzles = {
  // Relish's mistake: the red is delivered while the blue is still on its track
  leftover: parts(board({ '0,3': outlet(R, red), '1,3': goal([L], red), '0,5': outlet(R, blue), '1,5': track(LR), '2,5': track(LR) })),
  real: parts(board({ '0,3': outlet(R, red), '1,3': goal([L], red) })),
  // solved earlier, then tinkered with: the saved track crashes before the goal fills
  tinkered: parts(board({ '0,3': outlet(R, blue), '1,3': goal([L], red) })),
};
type Key = keyof typeof puzzles;

function progressWith(solved: boolean, ...keys: Key[]) {
  return keys.reduce((p, k) => recordAttempt(p, k, puzzles[k].solution, solved), emptyProgress());
}

const codeFor = (key: string) => puzzles[key as Key]?.puzzle;

test('clears only solves that relied on leaving trains behind', () => {
  expect(solvesToClear(progressWith(true, 'leftover', 'real', 'tinkered'), codeFor)).toEqual(['leftover']);
});

test('ignores unsolved levels and puzzles it no longer has', () => {
  expect(solvesToClear(progressWith(false, 'leftover'), codeFor)).toEqual([]);
  expect(solvesToClear(progressWith(true, 'leftover'), () => undefined)).toEqual([]);
});

test('clearing keeps the saved track', () => {
  const p = withSolvesCleared(progressWith(true, 'leftover', 'real'), ['leftover']);
  expect(p.levels.leftover).toEqual({ solved: false, solution: puzzles.leftover.solution });
  expect(p.levels.real!.solved).toBe(true);
});
