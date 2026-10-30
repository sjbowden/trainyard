import { render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { firstUnsolved, firstOfCity } from '../../src/app/levels.ts';
import { emptyProgress, levelKey, recordAttempt } from '../../src/app/progress.ts';
import { parseRoute, buildRoute } from '../../src/app/router.ts';
import { loadSettings, saveSettings } from '../../src/app/settings.ts';
import { HomeScreen } from '../../src/app/screens/HomeScreen.tsx';

const c: Collection = {
  id: 'trainyard',
  worlds: [
    { slug: 'a', name: 'A', starsToUnlock: 0, group: 'main', ordinal: 0 },
    { slug: 'b', name: 'B', starsToUnlock: 2, group: 'main', ordinal: 1 },
  ],
  levels: [
    { slug: 'a2', worldSlug: 'a', name: 'A2', stars: 1, code: 'hh', ordinal: 2 },
    { slug: 'a1', worldSlug: 'a', name: 'A1', stars: 1, code: 'hh', ordinal: 1 },
    { slug: 'b1', worldSlug: 'b', name: 'B1', stars: 1, code: 'hh', ordinal: 1 },
  ],
  tutorials: [],
};
const solved = (...slugs: string[]) => slugs.reduce((p, s) => recordAttempt(p, levelKey('trainyard', s), 'x', true), emptyProgress());

test('a fresh start begins at the first puzzle', () => {
  expect(firstUnsolved(c, emptyProgress())?.slug).toBe('a1');
});

test('play continues at the first unsolved puzzle in order', () => {
  expect(firstUnsolved(c, solved('a1'))?.slug).toBe('a2');
  expect(firstUnsolved(c, solved('a1', 'a2'))?.slug).toBe('b1');
  expect(firstUnsolved(c, solved('a1', 'a2', 'b1'))).toBeUndefined();
});

test('play skips puzzles in locked cities', () => {
  // a2 solved out of order, a1 not: only 1 star, so b stays locked
  expect(firstUnsolved(c, solved('a2'))?.slug).toBe('a1');
});

test('knows the first puzzle of each city', () => {
  expect(firstOfCity(c, 'a1')).toBe(true);
  expect(firstOfCity(c, 'a2')).toBe(false);
  expect(firstOfCity(c, 'b1')).toBe(true);
});

test('settings route', () => {
  expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  expect(buildRoute({ name: 'settings' })).toBe('#/settings');
});

afterEach(() => localStorage.clear());

test('the Solved! card is on unless turned off', () => {
  expect(loadSettings().showSolvedCard).toBe(true);
  saveSettings({ ...loadSettings(), showSolvedCard: false });
  expect(loadSettings().showSolvedCard).toBe(false);
});

test('home offers Play at the next puzzle and a way to choose one', () => {
  render(<HomeScreen collections={[c]} progress={solved('a1')} />);
  expect(screen.getByRole('link', { name: /Continue/ }).getAttribute('href')).toBe('#/p/trainyard/a2');
  expect(screen.getByRole('link', { name: 'Choose a puzzle' }).getAttribute('href')).toBe('#/c/trainyard');
});

test('home says Play on a fresh start', () => {
  render(<HomeScreen collections={[c]} progress={emptyProgress()} />);
  expect(screen.getByRole('link', { name: /Play/ }).getAttribute('href')).toBe('#/p/trainyard/a1');
});

test('the settings screen turns the Solved! card off', async () => {
  const { SettingsScreen } = await import('../../src/app/screens/SettingsScreen.tsx');
  render(<SettingsScreen />);
  const toggle = screen.getByRole('switch') as HTMLInputElement;
  expect(toggle.checked).toBe(true);
  toggle.click();
  expect(loadSettings().showSolvedCard).toBe(false);
});

test('speed is remembered, starting in the middle', () => {
  expect(loadSettings().speed).toBe(0.5);
  saveSettings({ ...loadSettings(), speed: 0.8 });
  expect(loadSettings().speed).toBe(0.8);
  expect(loadSettings().showSolvedCard).toBe(true);
});

