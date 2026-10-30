import { render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import type { CustomPuzzle } from '../../src/app/customPuzzles.ts';
import { buildRoute, parseRoute, type Route } from '../../src/app/router.ts';
import { MyPuzzlesScreen } from '../../src/app/screens/MyPuzzlesScreen.tsx';

test('parses and builds the custom puzzle routes', () => {
  const routes: [string, Route][] = [
    ['#/mine', { name: 'mine' }],
    ['#/edit/m-abc', { name: 'edit', id: 'm-abc' }],
    ['#/play/s-1234abcd', { name: 'play', id: 's-1234abcd' }],
    ['#/s/1.abc.0123abcd', { name: 'shared', payload: '1.abc.0123abcd' }],
  ];
  for (const [hash, route] of routes) {
    expect(parseRoute(hash)).toEqual(route);
    expect(buildRoute(route)).toBe(hash);
  }
});

const p = (over: Partial<CustomPuzzle>): CustomPuzzle => ({ id: 'm-1', source: 'mine', name: 'Mine', code: 'hh002Oja3Giaa00', proof: null, created: 1, ...over });

test('lists my puzzles and shared ones, marking only proven puzzles as ready to share', () => {
  render(
    <MyPuzzlesScreen
      puzzles={[p({ id: 'm-1', name: 'Draft' }), p({ id: 'm-2', name: 'Done', proof: '003QQQ00' }), p({ id: 's-1', source: 'shared', name: 'Gift' })]}
      onNew={() => {}}
      onPaste={() => {}}
    />,
  );
  expect(screen.getByText('Draft').closest('a')?.getAttribute('href')).toBe('#/edit/m-1');
  expect(screen.getByText('Gift').closest('a')?.getAttribute('href')).toBe('#/play/s-1');
  expect(screen.getAllByText('Ready to share')).toHaveLength(1);
  expect(screen.getByText('Shared with me')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'New puzzle' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paste puzzle link' })).toBeTruthy();
});
