import { expect, test } from 'vitest';
import { ATLAS_SIZE, FRAMES, TILE } from '../../src/app/theme/original/frames.ts';

test('every frame lies inside the atlas', () => {
  for (const [name, f] of Object.entries(FRAMES)) {
    expect(f.x >= 0 && f.y >= 0 && f.x + f.w <= ATLAS_SIZE && f.y + f.h <= ATLAS_SIZE, name).toBe(true);
  }
});

test('tiles are square and trains are tall', () => {
  for (const name of ['straight', 'curve', 'cross', 'rock', 'outlet', 'goalOpen'] as const) {
    expect([FRAMES[name].w, FRAMES[name].h], name).toEqual([TILE, TILE]);
  }
  expect(FRAMES.train.h).toBeGreaterThan(FRAMES.train.w);
});

test('station icons shrink as the grid grows', () => {
  for (const kind of ['outletNub', 'goalNub'] as const) {
    const sizes = ([1, 4, 9, 16] as const).map((n) => FRAMES[`${kind}${n}`].w);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  }
});
