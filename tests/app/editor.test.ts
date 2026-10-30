import { expect, test } from 'vitest';
import { EDITOR_COLORS, emptyBoard, placePiece, problems, proofHolds, updatePiece } from '../../src/app/editor.ts';
import { decodeBoard, encodeBoard } from '../../src/engine/codec.ts';
import { at } from '../engine/helpers.ts';

test('an empty board is 7×7 and empty', () => {
  const b = emptyBoard();
  expect(b.cols * b.rows).toBe(49);
  expect(b.cells.every((c) => c.kind === 'empty')).toBe(true);
});

test('each tool places its default piece, and erase empties the cell', () => {
  let b = emptyBoard();
  b = placePiece(b, 0, 'rock');
  b = placePiece(b, 1, 'outlet');
  b = placePiece(b, 2, 'goal');
  b = placePiece(b, 3, 'painter');
  b = placePiece(b, 4, 'splitter');
  expect(b.cells.slice(0, 5)).toEqual([
    { kind: 'rock' },
    { kind: 'outlet', side: 1, colors: [0] },
    { kind: 'goal', sides: [3], colors: [0] },
    { kind: 'painter', color: 0, a: 3, b: 1 },
    { kind: 'splitter', in: 3 },
  ]);
  expect(placePiece(b, 0, 'erase').cells[0]).toEqual({ kind: 'empty' });
});

test('every editor board encodes as a puzzle with no track', () => {
  const b = updatePiece(placePiece(emptyBoard(), 10, 'outlet'), 10, { kind: 'outlet', side: 2, colors: [1, 2, 3] });
  const code = encodeBoard(b, { solution: false });
  expect(code).not.toContain('_');
  expect(decodeBoard(code)).toEqual(b);
});

test('the editor offers six colors, not brown', () => {
  expect(EDITOR_COLORS).toEqual([0, 1, 2, 3, 4, 5]);
});

test('lists what a puzzle needs before it can be tested', () => {
  expect(problems(emptyBoard())).toEqual(['Add at least one outlet', 'Add at least one goal']);
  expect(problems(placePiece(placePiece(emptyBoard(), 22, 'outlet'), 26, 'goal'))).toEqual([]);
});

test('a proof holds only for the exact puzzle it solved', () => {
  expect(proofHolds('hh002Oja3Giaa00', '003QQQ00')).toBe(true);
  expect(proofHolds('hh002Oja3Giaa00', null)).toBe(false);
  expect(proofHolds('hh002Oja3Giaa00', '003QQ00')).toBe(false);
  // the goal moved down a row, off the end of the track
  const moved = updatePiece(updatePiece(decodeBoard('hh002Oja3Giaa00'), at(5, 3), { kind: 'empty' }), at(5, 4), { kind: 'goal', sides: [3], colors: [0] });
  expect(proofHolds(encodeBoard(moved, { solution: false }), '003QQQ00')).toBe(false);
});
