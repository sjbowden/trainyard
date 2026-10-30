import { expect, test } from 'vitest';
import { cellAt, cellCenter, fitBoard } from '../../src/app/board/geometry.ts';

test('fitBoard fills a 390px-wide screen with a 16px gutter', () => {
  const l = fitBoard(390, 600, 7, 7);
  expect(l.cell).toBeCloseTo((390 - 32) / 7);
  expect(l.originX).toBeCloseTo(16);
});

test('fitBoard is limited by height on a short area', () => {
  const l = fitBoard(390, 300, 7, 7);
  expect(l.cell).toBeCloseTo((300 - 32) / 7);
  expect(l.originX).toBeCloseTo((390 - l.cell * 7) / 2);
});

test('cellAt maps points to cells and returns null outside', () => {
  const l = fitBoard(390, 600, 7, 7);
  const c = cellCenter(l, 3 * 7 + 2);
  expect(cellAt(l, c.x, c.y)).toBe(23);
  expect(cellAt(l, l.originX + 0.5, l.originY + 0.5)).toBe(0);
  expect(cellAt(l, l.originX - 1, l.originY + 5)).toBeNull();
  expect(cellAt(l, l.originX + 5, l.originY + l.cell * 7 + 1)).toBeNull();
});
