import { afterEach, expect, test, vi } from 'vitest';
import { canvasSprites } from '../../src/app/theme/original/draw.ts';
import { TILE } from '../../src/app/theme/original/frames.ts';

afterEach(() => vi.restoreAllMocks());

// Safari before 16.4 has no OffscreenCanvas; the art must still draw there.
test('without OffscreenCanvas the sprites are drawn on page canvases', () => {
  vi.stubGlobal('OffscreenCanvas', undefined);
  const ctx = new Proxy({}, { get: () => () => {} });
  const made: HTMLCanvasElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = create(tag);
    if (el instanceof HTMLCanvasElement) {
      el.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
      made.push(el);
    }
    return el;
  });
  const sprites = canvasSprites({} as CanvasImageSource);
  expect(sprites.floor).toBe(made[0]);
  expect([made[0]!.width, made[0]!.height]).toEqual([TILE, TILE]);
  vi.unstubAllGlobals();
});
