import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BANDS, grade } from '../../src/solver/difficulty.ts';

const solved = (segments: number, nodes: number) => ({ status: 'solved' as const, solution: '', segments, nodes, optimal: false });

test('bands get stricter with difficulty', () => {
  expect(BANDS.easy.minSegments).toBeLessThan(BANDS.medium.minSegments);
  expect(BANDS.medium.minNodes).toBeLessThanOrEqual(BANDS.hard.minNodes);
  expect(BANDS.hard.minNodes).toBeLessThanOrEqual(BANDS.veryHard.minNodes);
  expect(BANDS.veryHard.acceptUnknown).toBe(true);
});

test('grades a solve by the hardest band it meets', () => {
  expect(grade(solved(3, 4))).toBe('tooEasy');
  expect(grade(solved(BANDS.easy.minSegments, 10))).toBe('easy');
  expect(grade(solved(BANDS.hard.minSegments, BANDS.hard.minNodes))).toBe('hard');
  expect(grade(solved(BANDS.veryHard.minSegments, BANDS.veryHard.minNodes))).toBe('veryHard');
});

test('a puzzle the solver could not crack in budget counts as very hard', () => {
  expect(grade({ status: 'unknown', nodes: 1, reason: 'budget' })).toBe('veryHard');
});

describe('bands match the calibration on the originals', () => {
  const calibration = JSON.parse(readFileSync('fixtures/solver-calibration.json', 'utf8')) as Record<string, { stars: number; status: 'solved' | 'unknown'; segments: number | null; nodes: number }>;
  const solvedIn = (lo: number, hi: number) => Object.values(calibration).filter((c) => c.stars >= lo && c.stars <= hi && c.status === 'solved');
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  test('a typical 1–3★ original grades as easy or medium', () => {
    const easy = solvedIn(1, 3);
    const typical = { status: 'solved' as const, solution: '', optimal: false, segments: median(easy.map((c) => c.segments!)), nodes: median(easy.map((c) => c.nodes)) };
    expect(['easy', 'medium']).toContain(grade(typical));
  });

  test('a typical solved 4–8★ original grades as hard', () => {
    const hard = solvedIn(4, 8);
    const typical = { status: 'solved' as const, solution: '', optimal: false, segments: median(hard.map((c) => c.segments!)), nodes: median(hard.map((c) => c.nodes)) };
    expect(grade(typical)).toBe('hard');
  });

  test('the 16★+ originals are beyond the solver, which counts as very hard', () => {
    const top = Object.values(calibration).filter((c) => c.stars >= 16);
    expect(top.length).toBeGreaterThan(0);
    for (const c of top) expect(grade({ status: 'unknown', nodes: c.nodes, reason: 'budget' })).toBe('veryHard');
  });
});
