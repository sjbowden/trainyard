import { expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { emptyProgress, isWorldUnlocked, levelKey, recordAttempt, starsEarned } from '../../src/app/progress.ts';

function collection(id: Collection['id']): Collection {
  return {
    id,
    worlds: [
      { slug: 'abbotsford', name: 'Abbotsford', starsToUnlock: 0, group: 'main', ordinal: 0 },
      { slug: 'brampton', name: 'Brampton', starsToUnlock: 6, group: 'main', ordinal: 1 },
    ],
    levels: [
      { slug: 'a1', worldSlug: 'abbotsford', name: 'A1', stars: 1, code: 'hh', ordinal: 1 },
      { slug: 'a2', worldSlug: 'abbotsford', name: 'A2', stars: 5, code: 'hh', ordinal: 2 },
      { slug: 'b1', worldSlug: 'brampton', name: 'B1', stars: 3, code: 'hh', ordinal: 1 },
    ],
    tutorials: [],
  };
}

const ty = collection('trainyard');
const solve = (p = emptyProgress(), id: Collection['id'], slug: string) => recordAttempt(p, levelKey(id, slug), 'x', true);

test('abbotsford is unlocked from the start', () => {
  expect(isWorldUnlocked(ty, 'abbotsford', emptyProgress())).toBe(true);
  expect(isWorldUnlocked(ty, 'brampton', emptyProgress())).toBe(false);
});

test('brampton unlocks at 6 stars', () => {
  const p = solve(solve(undefined, 'trainyard', 'a1'), 'trainyard', 'a2');
  expect(starsEarned(ty, p)).toBe(6);
  expect(isWorldUnlocked(ty, 'brampton', p)).toBe(true);
});

test('stars count each solved level once', () => {
  const p = solve(solve(undefined, 'trainyard', 'a2'), 'trainyard', 'a2');
  expect(starsEarned(ty, p)).toBe(5);
});

test('an unsolved attempt keeps an earlier solve', () => {
  const p = recordAttempt(solve(undefined, 'trainyard', 'a1'), levelKey('trainyard', 'a1'), 'y', false, 99);
  expect(p.levels['trainyard/a1']).toEqual({ solved: true, solution: 'y', at: 99 });
});

test('Trainyard and Express stars are separate', () => {
  const p = solve(undefined, 'express', 'a2');
  expect(starsEarned(collection('express'), p)).toBe(5);
  expect(starsEarned(ty, p)).toBe(0);
});
