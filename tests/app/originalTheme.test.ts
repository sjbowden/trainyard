import { describe, expect, test } from 'vitest';
import type { Color, Piece } from '../../src/engine/types.ts';
import { originalDrawing, type Sprites } from '../../src/app/theme/original/draw.ts';
import { FRAMES, type FrameName } from '../../src/app/theme/original/frames.ts';

interface Call { op: string; args: unknown[]; alpha: number }

/** A 2D context that records what is drawn, with the alpha in force at each call. */
function recorder() {
  const calls: Call[] = [];
  const ctx: Record<string, unknown> = { globalAlpha: 1 };
  const alphas: number[] = [];
  for (const op of ['drawImage', 'translate', 'rotate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'clip', 'rect', 'fill', 'stroke', 'arc', 'fillRect']) {
    ctx[op] = (...args: unknown[]) => calls.push({ op, args, alpha: ctx.globalAlpha as number });
  }
  ctx.save = () => alphas.push(ctx.globalAlpha as number);
  ctx.restore = () => (ctx.globalAlpha = alphas.pop() ?? 1);
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const atlas = { atlas: true } as unknown as CanvasImageSource;
const floor = { floor: true } as unknown as CanvasImageSource;
const sprites: Sprites = {
  atlas,
  floor,
  tinted: (name: FrameName, color: Color) => ({ name, color }) as unknown as CanvasImageSource,
};
const theme = originalDrawing(sprites);

/** What each drawImage call drew: an atlas frame's name, a tinted frame, or the floor. */
function drawn(calls: Call[]) {
  return calls.filter((c) => c.op === 'drawImage').map((c) => {
    const [src, ...rest] = c.args as [Record<string, unknown>, ...number[]];
    if (src === (atlas as unknown)) {
      const [sx, sy, sw, sh] = rest;
      const name = Object.entries(FRAMES).find(([, f]) => f.x === sx && f.y === sy && f.w === sw && f.h === sh)?.[0];
      return { what: name ?? 'unknown', alpha: c.alpha, dest: rest.slice(4) };
    }
    if (src === (floor as unknown)) return { what: 'floor', alpha: c.alpha, dest: rest };
    return { what: `${src.name as string}:${src.color as number}`, alpha: c.alpha, dest: rest };
  });
}

function draw(piece: Piece, size = 96) {
  const { ctx, calls } = recorder();
  theme.drawPiece(ctx, piece, 10, 20, size);
  return { calls, images: drawn(calls) };
}

describe('the board', () => {
  test('drawFloor draws one floor tile per cell, and an empty cell draws nothing more', () => {
    const { ctx, calls } = recorder();
    theme.drawFloor(ctx, { originX: 0, originY: 0, cell: 50, cols: 3, rows: 2 });
    expect(drawn(calls).map((d) => d.what)).toEqual(Array(6).fill('floor'));
    expect(draw({ kind: 'empty' }).images).toEqual([]);
  });

  test('a single track draws its base tile turned to fit', () => {
    // TopBottom is the straight tile as it sits in the atlas; LeftRight is it turned a quarter
    expect(draw({ kind: 'track', primary: 5, secondary: 0 }).images.map((d) => d.what)).toEqual(['straight']);
    const lr = draw({ kind: 'track', primary: 6, secondary: 0 });
    expect(lr.images.map((d) => d.what)).toEqual(['straight']);
    expect(lr.calls.find((c) => c.op === 'rotate')?.args[0]).toBeCloseTo(Math.PI / 2);
  });

  test('a switch draws the tile with its secondary already dimmed', () => {
    // BottomLeft (3) bright, BottomRight (4) dim is the switch tile untouched
    const sw = draw({ kind: 'track', primary: 3, secondary: 4 });
    expect(sw.images.map((d) => d.what)).toEqual(['switchCurves']);
    expect(sw.calls.some((c) => c.op === 'rotate' && Math.abs(c.args[0] as number) > 1e-9)).toBe(false);
    // flipped, BottomRight bright and BottomLeft dim: the same tile mirrored
    const flipped = draw({ kind: 'track', primary: 4, secondary: 3 });
    expect(flipped.images.map((d) => d.what)).toEqual(['switchCurves']);
    expect(flipped.calls.find((c) => c.op === 'scale')?.args).toEqual([-1, 1]);
  });

  test('a curve and a straight draw the right combined tile', () => {
    expect(draw({ kind: 'track', primary: 3, secondary: 5 }).images.map((d) => d.what)).toEqual(['curveStraight']);
    expect(draw({ kind: 'track', primary: 5, secondary: 3 }).images.map((d) => d.what)).toEqual(['straightCurve']);
    expect(draw({ kind: 'track', primary: 6, secondary: 5 }).images.map((d) => d.what)).toEqual(['cross']);
  });

  test('two curves that share no side draw both, neither dimmed', () => {
    const { images, calls } = draw({ kind: 'track', primary: 1, secondary: 3 });
    expect(images.map((d) => d.what)).toEqual(['curve', 'curve']);
    expect(images.every((d) => d.alpha === 1)).toBe(true);
    expect(calls.some((c) => c.op === 'clip')).toBe(true);
  });

  test('a cell holding only a secondary segment draws it dimmed', () => {
    const { images } = draw({ kind: 'track', primary: 0, secondary: 5 });
    expect(images.map((d) => d.what)).toEqual(['straight']);
    expect(images[0]!.alpha).toBeLessThan(1);
  });
});

describe('stations', () => {
  const nubs = (images: ReturnType<typeof drawn>) => images.filter((d) => d.what.includes('Nub')).map((d) => d.what);

  test('an outlet draws its floor, box and one icon per train in order', () => {
    const { images } = draw({ kind: 'outlet', side: 1, colors: [0, 2, 4] });
    expect(images.slice(0, 2).map((d) => d.what)).toEqual(['outlet', 'outletBox']);
    expect(nubs(images)).toEqual(['outletNub4:0', 'outletNub4:2', 'outletNub4:4']);
    expect(nubs(draw({ kind: 'outlet', side: 1, colors: [3] }).images)).toEqual(['outletNub1:3']);
  });

  test('busy stations use a bigger grid and stay inside the cell', () => {
    const colors = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2] as Color[];
    for (const piece of [{ kind: 'outlet', side: 0, colors }, { kind: 'goal', sides: [3], colors: [...colors, 3, 4, 5, 6, 0, 1] }] as Piece[]) {
      const { images } = draw(piece, 50);
      const icons = images.filter((d) => d.what.includes('Nub'));
      expect(icons.length).toBe((piece as { colors: Color[] }).colors.length);
      expect(icons.every((d) => d.what.includes('Nub16'))).toBe(true);
      for (const { dest: [dx, dy, dw, dh] } of icons as { dest: number[] }[]) {
        expect(dx! >= 10 && dy! >= 20 && dx! + dw! <= 60 && dy! + dh! <= 70).toBe(true);
      }
    }
  });

  test('a goal shows each side open or closed, and a check once full', () => {
    const { images } = draw({ kind: 'goal', sides: [3, 1], colors: [2] });
    expect(images.filter((d) => d.what === 'goalOpen')).toHaveLength(2);
    expect(images.filter((d) => d.what === 'goalClosed')).toHaveLength(2);
    expect(images.map((d) => d.what)).toContain('goalBox');
    expect(nubs(images)).toEqual(['goalNub1:2']);
    const done = draw({ kind: 'goal', sides: [3], colors: [] }).images.map((d) => d.what);
    expect(done).toContain('goalDone');
    expect(done).not.toContain('goalBox');
  });

  test('painters, splitters and rocks', () => {
    expect(draw({ kind: 'painter', color: 5, a: 3, b: 1 }).images.map((d) => d.what)).toEqual(['straight', 'painter:5']);
    const split = draw({ kind: 'splitter', in: 2 }).images.map((d) => d.what);
    expect(split).toEqual(['cross', 'splitter']);
    expect(draw({ kind: 'rock' }).images.map((d) => d.what)).toEqual(['rock']);
  });
});

test('drawTrain draws the tinted train centered, turned so its nose leads', () => {
  const { ctx, calls } = recorder();
  theme.drawTrain(ctx, 2, 100, 50, 0, 96);
  expect(calls.find((c) => c.op === 'translate')?.args).toEqual([100, 50]);
  expect(calls.find((c) => c.op === 'rotate')?.args[0]).toBeCloseTo(Math.PI / 2);
  const [img] = drawn(calls);
  expect(img!.what).toBe('train:2');
  const [dx, dy, dw, dh] = img!.dest as number[];
  expect([dx! + dw! / 2, dy! + dh! / 2]).toEqual([0, 0]);
  expect(dh).toBeGreaterThan(dw!);
});
