import { expect, test } from 'vitest';
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
