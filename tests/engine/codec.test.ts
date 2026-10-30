import { describe, expect, test } from 'vitest';
import { CodecError, decodeBoard, encodeBoard, splitCode } from '../../src/engine/codec.ts';

const RED_LINE = 'hh002Oja3Giaa00';
const RED_LINE_SOLVED = 'hh002Oja3Giaa00_003QQQ00';
const KES = 'hhGeah2Geaa2Geao04PcoPaoPaoPaoPaoPaoPbo04GbahOaJOaJOaJOaJOaJGbao';
const WELCOME = 'hh002OjC3GiaC00';

describe('decodeBoard', () => {
  test('decodes Red Line', () => {
    const b = decodeBoard(RED_LINE);
    expect(b.cols).toBe(7);
    expect(b.rows).toBe(7);
    expect(b.cells).toHaveLength(49);
    expect(b.cells[22]).toEqual({ kind: 'outlet', side: 1, colors: [0] });
    expect(b.cells[26]).toEqual({ kind: 'goal', sides: [3], colors: [0] });
    b.cells.forEach((c, i) => {
      if (i !== 22 && i !== 26) expect(c).toEqual({ kind: 'empty' });
    });
  });

  test('applies a solution', () => {
    const b = decodeBoard(RED_LINE_SOLVED);
    for (const i of [23, 24, 25]) expect(b.cells[i]).toEqual({ kind: 'track', primary: 6, secondary: 0 });
    expect(b.cells.filter((c) => c.kind === 'track')).toHaveLength(3);
  });

  test('decodes painters (Kes)', () => {
    const b = decodeBoard(KES);
    expect(b.cells[0]).toEqual({ kind: 'goal', sides: [2], colors: [1] });
    const painters = b.cells.filter((c) => c.kind === 'painter');
    expect(painters).toHaveLength(7);
    expect(painters[0]).toEqual({ kind: 'painter', color: 2, a: 2, b: 0 });
  });

  test('decodes the welcome tutorial board', () => {
    const b = decodeBoard(WELCOME);
    expect(b.cells[22]).toEqual({ kind: 'outlet', side: 1, colors: [4] });
    expect(b.cells[26]).toEqual({ kind: 'goal', sides: [3], colors: [4] });
  });

  test('decodes multi-train outlets, splitters and rocks', () => {
    // outlet out the bottom with 3 trains r,y,b; splitter entered from the left; a rock
    const b = decodeBoard('hhOuboSdR0000');
    expect(b.cells[0]).toEqual({ kind: 'outlet', side: 2, colors: [0, 1, 2] });
    expect(b.cells[1]).toEqual({ kind: 'splitter', in: 3 });
    expect(b.cells[2]).toEqual({ kind: 'rock' });
    expect(b.cells.slice(3).every((c) => c.kind === 'empty')).toBe(true);
  });

  test('rejects malformed codes', () => {
    const bad = ['__', '_h', 'hhO', 'hhGa', 'hh!', 'hh002Oja3Giaa00_00#', 'hhOz', 'hh' + 'R'.repeat(50), 'hh_' + 'Q'.repeat(50)];
    for (const code of bad) expect(() => decodeBoard(code), code).toThrow(CodecError);
  });
});

describe('encodeBoard', () => {
  test('round-trips every code it decodes', () => {
    for (const code of [RED_LINE, RED_LINE_SOLVED, KES, WELCOME, 'hhOuboSdR0000']) {
      expect(encodeBoard(decodeBoard(code))).toBe(code);
    }
  });

  test('refuses boards the format cannot represent', () => {
    const base = decodeBoard(RED_LINE);
    const withCell = (i: number, piece: Parameters<typeof encodeBoard>[0]['cells'][number]) => ({ ...base, cells: base.cells.map((c, j) => (j === i ? piece : c)) });
    const bad = [
      withCell(26, { kind: 'goal', sides: [3], colors: [] }),
      withCell(26, { kind: 'goal', sides: [3], colors: Array(64).fill(0) }),
      withCell(22, { kind: 'outlet', side: 1, colors: [] }),
      withCell(22, { kind: 'outlet', side: 1, colors: Array(10).fill(0) }),
      { ...base, cells: base.cells.slice(1) },
      withCell(22, { kind: 'outlet', side: 4 as never, colors: [0] }),
      withCell(22, { kind: 'outlet', side: 1, colors: [7 as never] }),
      withCell(23, { kind: 'track', primary: 7 as never, secondary: 0 }),
      withCell(23, { kind: 'splitter', in: -1 as never }),
      withCell(23, { kind: 'painter', color: 0, a: 1, b: 9 as never }),
    ];
    for (const b of bad) expect(() => encodeBoard(b)).toThrow(CodecError);
  });

  test.each([
    ['63 wide (the separator character)', 63, 1],
    ['63 tall', 1, 63],
    ['zero wide', 0, 1],
    ['fractional', 3.5, 2],
  ])('refuses a board %s', (_name, cols, rows) => {
    const cells = Array.from({ length: cols * rows }, () => ({ kind: 'rock' as const }));
    expect(() => encodeBoard({ cols, rows, cells })).toThrow(CodecError);
  });

  test('round-trips the largest boards and counts the format allows', () => {
    const wide = { cols: 62, rows: 1, cells: Array.from({ length: 62 }, () => ({ kind: 'rock' as const })) };
    const code = encodeBoard(wide);
    expect(splitCode(code).puzzle).toBe(code);
    expect(decodeBoard(code)).toEqual(wide);
    const big = decodeBoard(RED_LINE);
    big.cells[22] = { kind: 'outlet', side: 1, colors: Array(9).fill(2) };
    big.cells[26] = { kind: 'goal', sides: [3], colors: Array(63).fill(2) };
    expect(decodeBoard(encodeBoard(big))).toEqual(big);
  });

  test('can emit the puzzle or solution alone', () => {
    const b = decodeBoard(RED_LINE_SOLVED);
    expect(encodeBoard(b, { solution: false })).toBe(RED_LINE);
    expect(encodeBoard(b, { puzzle: false })).toBe('hh_003QQQ00');
  });
});

test('splitCode separates the halves', () => {
  expect(splitCode(RED_LINE_SOLVED)).toEqual({ puzzle: RED_LINE, solution: '003QQQ00' });
  expect(splitCode(RED_LINE)).toEqual({ puzzle: RED_LINE, solution: '' });
});
