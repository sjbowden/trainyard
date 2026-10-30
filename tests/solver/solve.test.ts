import { expect, test } from 'vitest';
import { decodeBoard, encodeBoard } from '../../src/engine/codec.ts';
import { simulate } from '../../src/engine/sim.ts';
import { COLOR, SIDE } from '../../src/engine/types.ts';
import { solve, type SolveResult } from '../../src/solver/solve.ts';
import { board, goal, outlet, painter, rock, splitter } from '../engine/helpers.ts';

const { T, R, B, L } = SIDE;
const { red, blue, yellow, purple } = COLOR;
const puzzle = (spec: Parameters<typeof board>[0]) => encodeBoard(board(spec), { solution: false });

function expectSolved(code: string, result: SolveResult) {
  expect(result.status).toBe('solved');
  if (result.status !== 'solved') return;
  expect(simulate(decodeBoard(`${code}_${result.solution}`)).outcome).toBe('won');
}

test('solves Red Line with the fewest segments', () => {
  const r = solve('hh002Oja3Giaa00');
  expectSolved('hh002Oja3Giaa00', r);
  expect(r.status === 'solved' && r.segments).toBe(3);
});

test('routes around a rock', () => {
  const code = puzzle({ '1,3': outlet(R, red), '3,3': rock, '5,3': goal([L], red) });
  const r = solve(code);
  expectSolved(code, r);
  expect(r.status === 'solved' && r.segments).toBe(5); // up and over the rock: five cells
});

test('merges two trains to mix their colors', () => {
  const code = puzzle({ '0,1': outlet(R, red), '0,5': outlet(R, blue), '6,3': goal([L], purple) });
  expectSolved(code, solve(code));
});

test('uses a painter', () => {
  const code = puzzle({ '1,3': outlet(R, red), '3,3': painter(blue, L, R), '5,3': goal([L], blue) });
  expectSolved(code, solve(code));
});

test('uses a splitter', () => {
  const code = puzzle({ '3,0': outlet(B, purple), '3,2': splitter(T), '0,2': goal([R], red), '6,2': goal([L], blue) });
  expectSolved(code, solve(code));
});

test('builds a switch to send two trains to two goals', () => {
  const code = puzzle({ '3,0': outlet(B, red, red), '5,2': goal([L], red), '1,2': goal([R], red) });
  expectSolved(code, solve(code));
});

test('gives up within its node budget', () => {
  const code = puzzle({ '0,1': outlet(R, red), '0,5': outlet(R, blue), '6,3': goal([L], purple) });
  expect(solve(code, { maxNodes: 5 })).toMatchObject({ status: 'unknown', reason: 'budget' });
});

test('reports an unsolvable puzzle as exhausted', () => {
  const code = puzzle({ '1,3': outlet(R, red), '5,3': goal([L], red), '4,3': rock, '5,2': rock, '5,4': rock, '6,3': rock });
  expect(solve(code, { maxSegments: 12 })).toMatchObject({ status: 'unknown', reason: 'exhausted' });
});

test('respects a deadline', () => {
  const code = puzzle({ '0,0': outlet(R, red, yellow, blue), '6,6': goal([T], blue, red, yellow) });
  expect(solve(code, { deadline: performance.now() - 1 })).toMatchObject({ status: 'unknown', reason: 'deadline' });
});
