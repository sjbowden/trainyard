import { describe, expect, test } from 'vitest';
import { BANDS, creditLine, groupPuzzles, groupSlug, groupSummaries, homeGroup, libraryKey, nextPuzzle, parseGroupSlug, searchLibrary, type LibraryGroup } from '../../src/app/library.ts';
import { puzzle } from './libraryFixture.ts';

const lib = [
  puzzle('a', { name: 'Alpha', wrenches: 7, likes: 5, solves: 50 }),
  puzzle('b', { name: 'Bravo', wrenches: 9, likes: 9, solves: 10 }),
  puzzle('c', { name: 'Charlie', wrenches: 6, likes: 5, solves: 30 }),
  puzzle('d', { name: 'Delta', wrenches: 30, likes: 1, solves: 1 }),
  puzzle('e', { name: 'Echo', wrenches: 1, likes: 0, solves: 0, featured: { set: 'Lorne Park', order: 1 } }),
  puzzle('f', { name: 'Foxtrot', wrenches: 25, likes: 99, solves: 99, featured: { set: 'Lorne Park', order: 0 } }),
  puzzle('g', { name: 'Golf', wrenches: 1, likes: 3, solves: 3, featured: { set: 'Port Credit', order: 0 } }),
];
const band6: LibraryGroup = { kind: 'band', band: 1 };
const lorne: LibraryGroup = { kind: 'featured', set: 'Lorne Park' };
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

test('bands cover 1 to 30 with no gaps or overlaps', () => {
  expect(BANDS[0]!.from).toBe(1);
  expect(BANDS.at(-1)!.to).toBe(30);
  BANDS.slice(1).forEach((b, i) => expect(b.from).toBe(BANDS[i]!.to + 1));
  expect(BANDS.map((b) => `${b.from}-${b.to}`)).toEqual(['1-5', '6-10', '11-17', '18-24', '25-30']);
});

test('a band sorts by likes or by solves, most first, ties by name', () => {
  expect(ids(groupPuzzles(lib, band6, 'likes'))).toEqual(['b', 'a', 'c']);
  expect(ids(groupPuzzles(lib, band6, 'solves'))).toEqual(['a', 'c', 'b']);
});

test('puzzles tied on count and name keep the same order whatever order the file lists them in', () => {
  const twins = [puzzle('y', { name: 'Same', likes: 4 }), puzzle('x', { name: 'Same', likes: 4 })];
  expect(ids(groupPuzzles(twins, band6, 'likes'))).toEqual(['x', 'y']);
  expect(ids(groupPuzzles([...twins].reverse(), band6, 'likes'))).toEqual(['x', 'y']);
});

test("a featured set keeps the site's order whatever the sort", () => {
  expect(ids(groupPuzzles(lib, lorne, 'likes'))).toEqual(['f', 'e']);
  expect(ids(groupPuzzles(lib, lorne, 'solves'))).toEqual(['f', 'e']);
});

test('featured puzzles also appear in their difficulty band', () => {
  expect(ids(groupPuzzles(lib, { kind: 'band', band: 4 }, 'likes'))).toEqual(['f', 'd']);
});

test('summaries list featured sets in order, then non-empty bands, with solved counts from progress', () => {
  const progress = { levels: { [libraryKey('b')]: { solved: true, solution: '' }, [libraryKey('a')]: { solved: false, solution: 'x' } } };
  expect(groupSummaries(lib, progress).map((s) => [s.label, s.count, s.solved])).toEqual([
    ['Port Credit', 1, 0],
    ['Lorne Park', 2, 0],
    ['1–5 wrenches', 2, 0],
    ['6–10 wrenches', 3, 1],
    ['25–30 wrenches', 2, 0],
  ]);
});

test('Next follows the list, then opens the first puzzle of the following group, and stops after the last', () => {
  expect(nextPuzzle(lib, band6, 'likes', 'b')).toEqual({ puzzle: lib[0], group: band6 });
  expect(nextPuzzle(lib, band6, 'likes', 'c')).toMatchObject({ puzzle: { id: 'f' }, group: { kind: 'band', band: 4 } });
  expect(nextPuzzle(lib, { kind: 'featured', set: 'Port Credit' }, 'likes', 'g')).toMatchObject({ puzzle: { id: 'f' }, group: lorne });
  expect(nextPuzzle(lib, { kind: 'band', band: 4 }, 'likes', 'd')).toBeUndefined();
  expect(nextPuzzle(lib, band6, 'likes', 'zzz')).toBeUndefined();
});

test('Next can skip solved puzzles, across groups too', () => {
  const solved = (id: string) => ['a', 'c', 'f'].includes(id);
  expect(nextPuzzle(lib, band6, 'likes', 'b', solved)).toMatchObject({ puzzle: { id: 'd' }, group: { kind: 'band', band: 4 } });
  expect(nextPuzzle(lib, band6, 'likes', 'b', () => true)).toBeUndefined();
});

test('search matches names and creators, ignoring capitals and accents, most liked first', () => {
  const ps = [
    puzzle('1', { name: 'Crème Brûlée', creator: 'x', likes: 1 }),
    puzzle('2', { name: 'Loop', creator: 'José', likes: 5 }),
    puzzle('3', { name: 'Other', creator: 'y', likes: 9 }),
  ];
  expect(ids(searchLibrary(ps, 'creme'))).toEqual(['1']);
  expect(ids(searchLibrary(ps, 'JOSE'))).toEqual(['2']);
  expect(ids(searchLibrary(ps, 'o'))).toEqual(['3', '2']);
  expect(ids(searchLibrary(ps, '  loop  jose '))).toEqual(['2']);
  expect(searchLibrary(ps, '   ')).toEqual([]);
});

test("a puzzle's home group is its featured set, or else its wrench band", () => {
  expect(homeGroup(lib[5]!)).toEqual(lorne);
  expect(homeGroup(lib[0]!)).toEqual(band6);
  expect(homeGroup(puzzle('z', { wrenches: 0 }))).toEqual({ kind: 'band', band: 0 });
});

test('group slugs round-trip, including a set name with spaces, and nonsense parses to null', () => {
  for (const g of [lorne, band6, { kind: 'band', band: 0 } as LibraryGroup]) expect(parseGroupSlug(groupSlug(g))).toEqual(g);
  for (const s of ['', 'x', 'w-9', 'w-', 'w-1.5', 'f-', 'f-Nowhere']) expect(parseGroupSlug(s)).toBeNull();
});

test('the credit line leaves out a missing creator', () => {
  expect(creditLine(puzzle('1', { creator: 'Matt', wrenches: 7, likes: 3 }))).toBe('by Matt · 7 🔧 · 3 likes');
  expect(creditLine(puzzle('1', { creator: '', wrenches: 7, likes: 3 }))).toBe('7 🔧 · 3 likes');
});
