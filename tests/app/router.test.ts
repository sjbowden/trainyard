import { expect, test } from 'vitest';
import { buildRoute, parseRoute, puzzleBackRoute, type Route } from '../../src/app/router.ts';

test('parses and builds every route', () => {
  const routes: [string, Route][] = [
    ['#/', { name: 'home' }],
    ['#/load', { name: 'load' }],
    ['#/c/trainyard', { name: 'collection', collection: 'trainyard' }],
    ['#/c/express/britishColumbia', { name: 'city', collection: 'express', world: 'britishColumbia' }],
    ['#/p/trainyard/redLine', { name: 'puzzle', collection: 'trainyard', slug: 'redLine' }],
  ];
  for (const [hash, route] of routes) {
    expect(parseRoute(hash)).toEqual(route);
    expect(buildRoute(route)).toBe(hash);
  }
});

test('unknown or empty hashes go home', () => {
  expect(parseRoute('')).toEqual({ name: 'home' });
  expect(parseRoute('#/nowhere')).toEqual({ name: 'home' });
  expect(parseRoute('#/c/notacollection')).toEqual({ name: 'home' });
});

test("a puzzle's Back goes home if play started there, else to the puzzle's own city", () => {
  expect(puzzleBackRoute({ name: 'home' }, 'trainyard', 'brampton')).toEqual({ name: 'home' });
  expect(puzzleBackRoute(null, 'trainyard', 'brampton')).toEqual({ name: 'home' });
  expect(puzzleBackRoute({ name: 'city', collection: 'trainyard', world: 'abbotsford' }, 'trainyard', 'brampton')).toEqual({ name: 'city', collection: 'trainyard', world: 'brampton' });
  expect(puzzleBackRoute({ name: 'collection', collection: 'trainyard' }, 'trainyard', 'brampton')).toEqual({ name: 'city', collection: 'trainyard', world: 'brampton' });
});
