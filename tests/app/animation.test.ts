import { expect, test } from 'vitest';
import { speedFromSlider, trainPose } from '../../src/app/board/animation.ts';
import { cellCenter, fitBoard } from '../../src/app/board/geometry.ts';
import { SIDE } from '../../src/engine/types.ts';

const l = fitBoard(390 + 32, 600, 7, 7, 16); // cell = 390/7
const { T, R, B, L } = SIDE;

test('trainPose is at the entry edge at 0, the center at 0.5 and the exit edge at 1', () => {
  const c = cellCenter(l, 24);
  const half = l.cell / 2;
  expect(trainPose(24, L, R, 0, l)).toMatchObject({ x: expect.closeTo(c.x - half), y: expect.closeTo(c.y) });
  expect(trainPose(24, L, R, 0.5, l)).toMatchObject({ x: expect.closeTo(c.x), y: expect.closeTo(c.y) });
  expect(trainPose(24, L, R, 1, l)).toMatchObject({ x: expect.closeTo(c.x + half), y: expect.closeTo(c.y) });
  expect(trainPose(24, L, R, 0.5, l).angle).toBeCloseTo(0);
  expect(trainPose(24, B, T, 0.5, l).angle).toBeCloseTo(-Math.PI / 2);
});

test('trainPose follows a quarter-circle on corners', () => {
  const c = cellCenter(l, 24);
  const half = l.cell / 2;
  // in from the left, out the top: arc centered on the top-left corner, radius half a cell
  const mid = trainPose(24, L, T, 0.5, l);
  const corner = { x: c.x - half, y: c.y - half };
  expect(Math.hypot(mid.x - corner.x, mid.y - corner.y)).toBeCloseTo(half);
  expect(trainPose(24, L, T, 1, l)).toMatchObject({ x: expect.closeTo(c.x), y: expect.closeTo(c.y - half) });
});

test('speedFromSlider matches the original curve', () => {
  expect(speedFromSlider(0)).toBe(0);
  expect(speedFromSlider(0.5)).toBeCloseTo(3);
  expect(speedFromSlider(1)).toBeCloseTo(15);
});
