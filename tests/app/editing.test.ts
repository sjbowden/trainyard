import { expect, test } from 'vitest';
import { clearTrack, drawPath, eraseCells, History, toggleSwitch } from '../../src/app/editing.ts';
import { SEGMENT, SIDE } from '../../src/engine/types.ts';
import { at, board, outlet, track } from '../engine/helpers.ts';

const { TR, TL, BL, TB, LR } = SEGMENT;
const path = (...cr: [number, number][]) => cr.map(([c, r]) => at(c, r));
const empty = () => board({});

test('draws a straight line through the middle cell', () => {
  const b = drawPath(empty(), path([1, 3], [2, 3], [3, 3]));
  expect(b.cells[at(2, 3)]).toEqual(track(LR));
  expect(b.cells.filter((c) => c.kind === 'track')).toHaveLength(1);
});

test('draws a corner', () => {
  // in from the left, out the top
  const b = drawPath(empty(), path([1, 3], [2, 3], [2, 2]));
  expect(b.cells[at(2, 3)]).toEqual(track(TL));
});

test('redrawing a different segment makes a switch with the new one on top', () => {
  let b = drawPath(empty(), path([1, 3], [2, 3], [3, 3]));
  b = drawPath(b, path([1, 3], [2, 3], [2, 2]));
  expect(b.cells[at(2, 3)]).toEqual(track(TL, LR));
});

test('redrawing the top segment removes the other', () => {
  let b = drawPath(empty(), path([1, 3], [2, 3], [3, 3]));
  b = drawPath(b, path([1, 3], [2, 3], [2, 2]));
  b = drawPath(b, path([1, 3], [2, 3], [2, 2]));
  expect(b.cells[at(2, 3)]).toEqual(track(TL));
});

test('a third segment pushes out the oldest', () => {
  let b = drawPath(empty(), path([1, 3], [2, 3], [3, 3])); // LR
  b = drawPath(b, path([2, 2], [2, 3], [2, 4])); // TB on top, LR below
  b = drawPath(b, path([2, 2], [2, 3], [3, 3])); // TR on top, TB below
  expect(b.cells[at(2, 3)]).toEqual(track(TR, TB));
});

test('drawPath interpolates skipped cells', () => {
  const b = drawPath(empty(), path([0, 3], [3, 3]));
  expect(b.cells[at(1, 3)]).toEqual(track(LR));
  expect(b.cells[at(2, 3)]).toEqual(track(LR));
});

test('repeated touches of the same cell count once', () => {
  const b = drawPath(empty(), path([1, 3], [1, 3], [2, 3], [2, 3], [3, 3]));
  expect(b.cells[at(2, 3)]).toEqual(track(LR));
});

test('never changes puzzle pieces', () => {
  const start = board({ '2,3': outlet(SIDE.R, 0) });
  const b = drawPath(start, path([1, 3], [2, 3], [3, 3]));
  expect(b.cells[at(2, 3)]).toEqual(outlet(SIDE.R, 0));
});

test('a U-turn lays nothing', () => {
  const b = drawPath(empty(), path([1, 3], [2, 3], [1, 3]));
  expect(b.cells.every((c) => c.kind === 'empty')).toBe(true);
});

test('does not modify its input', () => {
  const start = empty();
  drawPath(start, path([1, 3], [2, 3], [3, 3]));
  expect(start.cells.every((c) => c.kind === 'empty')).toBe(true);
});

test('eraseCells removes track and leaves pieces', () => {
  const start = board({ '1,1': track(LR), '2,1': outlet(SIDE.R, 0) });
  const b = eraseCells(start, path([1, 1], [2, 1]));
  expect(b.cells[at(1, 1)]).toEqual({ kind: 'empty' });
  expect(b.cells[at(2, 1)]).toEqual(outlet(SIDE.R, 0));
});

test('toggleSwitch flips only switchable cells', () => {
  const start = board({ '1,1': track(TL, TR), '2,1': track(LR, TB), '3,1': track(LR) });
  const b = toggleSwitch(toggleSwitch(toggleSwitch(start, at(1, 1)), at(2, 1)), at(3, 1));
  expect(b.cells[at(1, 1)]).toEqual(track(TR, TL));
  expect(b.cells[at(2, 1)]).toEqual(track(LR, TB));
  expect(b.cells[at(3, 1)]).toEqual(track(LR));
});

test('clearTrack removes all track', () => {
  const b = clearTrack(board({ '1,1': track(BL), '2,1': outlet(SIDE.R, 0) }));
  expect(b.cells.filter((c) => c.kind === 'track')).toHaveLength(0);
  expect(b.cells[at(2, 1)]).toEqual(outlet(SIDE.R, 0));
});

test('history undo and redo', () => {
  const a = empty();
  const h = new History(a);
  const b = drawPath(a, path([1, 3], [2, 3], [3, 3]));
  h.push(b);
  expect(h.canUndo).toBe(true);
  expect(h.undo()).toBe(a);
  expect(h.canRedo).toBe(true);
  expect(h.redo()).toBe(b);
  h.undo();
  h.push(clearTrack(a));
  expect(h.canRedo).toBe(false);
});
