import { fireEvent, render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import { libraryKey } from '../../src/app/library.ts';
import { emptyProgress, recordAttempt } from '../../src/app/progress.ts';
import { LibraryListScreen } from '../../src/app/screens/LibraryListScreen.tsx';
import { LibraryScreen } from '../../src/app/screens/LibraryScreen.tsx';
import { puzzle } from './libraryFixture.ts';

test('the library screen asks for the file when none is loaded', () => {
  render(<LibraryScreen library={null} progress={emptyProgress()} onLoaded={() => {}} />);
  expect(screen.getByText(/Load the library file made from trainyard.ca/)).toBeTruthy();
  expect(screen.getByText('Choose library file')).toBeTruthy();
});

test('with a library it lists the featured sets, then the bands, with solved counts', () => {
  const lib = [puzzle('1', { wrenches: 1, featured: { set: 'Cooksville', order: 0 } }), puzzle('2', { wrenches: 12 }), puzzle('3', { wrenches: 13 })];
  const progress = recordAttempt(emptyProgress(), libraryKey('3'), 'x', true);
  render(<LibraryScreen library={lib} progress={progress} onLoaded={() => {}} />);
  const tiles = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/library/'));
  expect(tiles.map((t) => t.textContent)).toEqual(['Cooksville0 of 1 solved', '1–5 wrenches0 of 1 solved', '11–17 wrenches1 of 2 solved']);
  expect(screen.getByText('Load a newer library file')).toBeTruthy();
});

test('a band list sorts by the chosen order and shows 100 rows, then more', () => {
  const lib = Array.from({ length: 130 }, (_, i) => puzzle(String(i), { name: `P${i}`, wrenches: 7, likes: i, solves: 130 - i }));
  const progress = recordAttempt(emptyProgress(), libraryKey('129'), 'x', true);
  const sorts: string[] = [];
  const { rerender } = render(<LibraryListScreen library={lib} group={{ kind: 'band', band: 1 }} progress={progress} sort="likes" onSort={(s) => sorts.push(s)} />);
  let rows = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/library/w-1/'));
  expect(rows).toHaveLength(100);
  expect(rows[0]!.textContent).toContain('P129');
  expect(rows[0]!.textContent).toContain('✓');
  expect(rows[1]!.textContent).not.toContain('✓');
  fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
  expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/library/w-1/'))).toHaveLength(130);
  expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Most solved' }));
  expect(sorts).toEqual(['solves']);
  rerender(<LibraryListScreen library={lib} group={{ kind: 'band', band: 1 }} progress={progress} sort="solves" onSort={() => {}} />);
  rows = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/library/w-1/'));
  expect(rows[0]!.textContent).toContain('P0');
});

test('a featured set has no sort toggle', () => {
  render(<LibraryListScreen library={[puzzle('1', { featured: { set: 'Erindale', order: 0 } })]} group={{ kind: 'featured', set: 'Erindale' }} progress={emptyProgress()} sort="likes" onSort={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Most solved' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Erindale' })).toBeTruthy();
});

test('a name with markup shows as text', () => {
  const { container } = render(<LibraryListScreen library={[puzzle('1', { name: '<b>x</b>', creator: '"Q" & 🚂' })]} group={{ kind: 'band', band: 1 }} progress={emptyProgress()} sort="likes" onSort={() => {}} />);
  expect(container.textContent).toContain('<b>x</b>');
  expect(container.textContent).toContain('by "Q" & 🚂');
  expect(container.querySelector('b')).toBeNull();
});

test('loading a library says how many puzzles could not be read', async () => {
  const { libraryText } = await import('./libraryFixture.ts');
  render(<LibraryScreen library={null} progress={emptyProgress()} onLoaded={() => {}} />);
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File([libraryText([puzzle('1'), puzzle('2'), puzzle('3', { code: 'zz!' })])], 'library.json');
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
  expect(await screen.findByText("Loaded 2 puzzles (1 couldn't be read).")).toBeTruthy();
});

test('coming back to a long list shows the puzzle just played, past the first 100', () => {
  const scrolled: string[] = [];
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.textContent ?? ''); };
  const lib = Array.from({ length: 300 }, (_, i) => puzzle(String(i), { name: `P${i}`, wrenches: 7, likes: 300 - i }));
  render(<LibraryListScreen library={lib} group={{ kind: 'band', band: 1 }} progress={emptyProgress()} sort="likes" onSort={() => {}} focusId="250" />);
  expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/library/w-1/'))).toHaveLength(300);
  expect(scrolled.some((t) => t.includes('P250'))).toBe(true);
  Element.prototype.scrollIntoView = original;
});

test('a puzzle with no creator name shows no "by" line', () => {
  render(<LibraryListScreen library={[puzzle('1', { creator: ' ' }), puzzle('2', { creator: 'Matt' })]} group={{ kind: 'band', band: 1 }} progress={emptyProgress()} sort="likes" onSort={() => {}} />);
  expect(screen.getAllByText(/^by\b/).map((e) => e.textContent)).toEqual(['by Matt']);
});

const searchLib = [
  puzzle('1', { name: 'Straight Shot', creator: 'Tester', wrenches: 7, likes: 5 }),
  puzzle('2', { name: 'Loop de Loop', creator: 'Someone', wrenches: 12, likes: 9, featured: { set: 'Erindale', order: 0 } }),
  puzzle('3', { name: 'Other', creator: 'Tester', wrenches: 7, likes: 1 }),
];
const rowLinks = () => screen.getAllByRole('link').filter((a) => /^#\/library\/[^/]+\/[^/]+$/.test(a.getAttribute('href') ?? ''));

test('searching shows matching puzzles in place of the groups, each opening in its home group', () => {
  const queries: string[] = [];
  render(<LibraryScreen library={searchLib} progress={emptyProgress()} onLoaded={() => {}} onQuery={(q) => queries.push(q)} />);
  fireEvent.input(screen.getByRole('searchbox', { name: 'Search puzzles' }), { target: { value: 'tester' } });
  expect(rowLinks().map((a) => [a.textContent?.split('by')[0], a.getAttribute('href')])).toEqual([
    ['Straight Shot', '#/library/w-1/1'],
    ['Other', '#/library/w-1/3'],
  ]);
  expect(screen.queryByText('6–10 wrenches')).toBeNull();
  expect(queries.at(-1)).toBe('tester');
  fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'loop' } });
  expect(rowLinks().map((a) => a.getAttribute('href'))).toEqual(['#/library/f-Erindale/2']);
  fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'nothing like it' } });
  expect(screen.getByText('No puzzles match.')).toBeTruthy();
});

test('the search comes back as it was left', () => {
  render(<LibraryScreen library={searchLib} progress={emptyProgress()} onLoaded={() => {}} query="loop" />);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('loop');
  expect(rowLinks()).toHaveLength(1);
});

test('Hide solved hides solved puzzles from search results', () => {
  const progress = recordAttempt(emptyProgress(), libraryKey('1'), 'x', true);
  const changes: boolean[] = [];
  render(<LibraryScreen library={searchLib} progress={progress} onLoaded={() => {}} query="tester" hideSolved onHideSolved={(h) => changes.push(h)} />);
  expect(rowLinks().map((a) => a.getAttribute('href'))).toEqual(['#/library/w-1/3']);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hide solved' }));
  expect(changes).toEqual([false]);
});

test('Hide solved hides solved puzzles from a list, except the one just played', () => {
  const lib = [puzzle('1', { wrenches: 7 }), puzzle('2', { wrenches: 7 }), puzzle('3', { wrenches: 7 })];
  const progress = recordAttempt(recordAttempt(emptyProgress(), libraryKey('1'), 'x', true), libraryKey('2'), 'x', true);
  const changes: boolean[] = [];
  const props = { library: lib, group: { kind: 'band', band: 1 } as const, progress, sort: 'likes' as const, onSort: () => {}, onHideSolved: (h: boolean) => changes.push(h) };
  const { rerender } = render(<LibraryListScreen {...props} hideSolved={false} />);
  expect(rowLinks()).toHaveLength(3);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hide solved' }));
  expect(changes).toEqual([true]);
  rerender(<LibraryListScreen {...props} hideSolved focusId="2" />);
  expect(rowLinks().map((a) => a.getAttribute('href'))).toEqual(['#/library/w-1/2', '#/library/w-1/3']);
});

test('coming back to search keeps the puzzle just played: shown past the first 100, and kept while hiding solved', () => {
  const many = Array.from({ length: 130 }, (_, i) => puzzle(String(i), { name: `Match ${i}`, wrenches: 7, likes: 130 - i }));
  const progress = recordAttempt(emptyProgress(), libraryKey('120'), 'x', true);
  render(<LibraryScreen library={many} progress={progress} onLoaded={() => {}} query="match" hideSolved focusId="120" />);
  expect(rowLinks()).toHaveLength(130);
  expect(rowLinks().some((a) => a.getAttribute('href') === '#/library/w-1/120')).toBe(true);
});
