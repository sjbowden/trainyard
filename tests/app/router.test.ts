import { expect, test } from 'vitest';
import { buildRoute, parseRoute, type Route } from '../../src/app/router.ts';

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
