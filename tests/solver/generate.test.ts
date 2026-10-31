import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { decodeBoard, encodeBoard } from '../../src/engine/codec.ts';
import { simulate } from '../../src/engine/sim.ts';
import type { Difficulty } from '../../src/solver/difficulty.ts';
import { generateCandidate } from '../../src/solver/generate.ts';
import { mulberry32 } from '../../src/solver/random.ts';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'veryHard'];

test('the random source is seeded and repeatable', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = Array.from({ length: 5 }, () => a());
  expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
  expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
});

describe.each(DIFFICULTIES)('%s candidates', (difficulty) => {
  const candidates = Array.from({ length: 150 }, (_, seed) => generateCandidate(seed, difficulty)).filter((c) => c !== null);

  test('enough seeds produce a candidate (building one is cheap; very hard yields least)', () => {
    expect(candidates.length).toBeGreaterThan(150 * 0.15);
  });

  test('every candidate is a valid puzzle whose proof wins', () => {
    for (const c of candidates) {
      const board = decodeBoard(c!.code);
      expect(board.cells.some((p) => p.kind === 'outlet')).toBe(true);
      expect(board.cells.some((p) => p.kind === 'goal')).toBe(true);
      for (const p of board.cells) if (p.kind === 'goal' || p.kind === 'outlet') expect(p.colors.length).toBeLessThanOrEqual(9);
      expect(board.cells.some((p) => p.kind === 'track')).toBe(false);
      expect(simulate(decodeBoard(`${c!.code}_${c!.proof}`)).outcome, c!.code).toBe('won');
    }
  });

  test('the same seed gives the same puzzle, and seeds vary', () => {
    expect(generateCandidate(7, difficulty)).toEqual(generateCandidate(7, difficulty));
    expect(new Set(candidates.map((c) => c!.code)).size).toBeGreaterThan(candidates.length * 0.9);
  });
});

test('easy puzzles have no painters or splitters; hard ones use the richer pieces', () => {
  const kinds = (d: Difficulty) => new Set<string>(Array.from({ length: 150 }, (_, s) => generateCandidate(s, d)).flatMap((c) => (c ? decodeBoard(`${c.code}_${c.proof}`).cells : [])).map((p) => (p.kind === 'track' && p.secondary ? 'switch' : p.kind)));
  const easy = kinds('easy');
  expect(easy.has('painter') || easy.has('splitter')).toBe(false);
  const hard = kinds('hard');
  for (const k of ['painter', 'splitter', 'switch', 'rock']) expect(hard.has(k), k).toBe(true);
});

test.skipIf(!existsSync('local/collections.json'))('never reproduces an original puzzle', () => {
  const canonical = (code: string) => encodeBoard(decodeBoard(code), { solution: false });
  const originals = new Set((JSON.parse(readFileSync('local/collections.json', 'utf8')) as Collection[]).flatMap((c) => c.levels.map((l) => canonical(l.code))));
  for (const d of DIFFICULTIES) for (let s = 0; s < 150; s++) {
    const c = generateCandidate(s, d);
    if (c) expect(originals.has(canonical(c.code))).toBe(false);
  }
});
