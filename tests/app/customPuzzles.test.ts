import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addShared, deleteCustomPuzzle, listCustomPuzzles, saveCustomPuzzle, uniqueName, type CustomPuzzle } from '../../src/app/customPuzzles.ts';
import { loadProgress, saveProgress } from '../../src/app/store.ts';

beforeEach(() => clear(createStore('trainyard', 'kv')));
afterEach(() => vi.restoreAllMocks());

const mine = (id: string, created: number): CustomPuzzle => ({ id, source: 'mine', name: id, code: 'hh002Oja3Giaa00', proof: null, created });

test('saves and lists puzzles, newest first', async () => {
  await saveCustomPuzzle(mine('m-a', 1));
  await saveCustomPuzzle(mine('m-b', 2));
  await saveCustomPuzzle({ ...mine('m-a', 1), name: 'renamed' });
  const list = await listCustomPuzzles();
  expect(list.map((p) => p.id)).toEqual(['m-b', 'm-a']);
  expect(list[1]!.name).toBe('renamed');
});

test('adding the same shared puzzle twice keeps one', async () => {
  const s = { name: 'Gift', code: 'hh002OjC3GiaC00' };
  const first = await addShared(s);
  const second = await addShared(s);
  expect(second.puzzle.id).toBe(first.puzzle.id);
  expect(first.saved).toBe(true);
  expect((await listCustomPuzzles()).filter((p) => p.source === 'shared')).toHaveLength(1);
});

test('deleting a puzzle removes its progress and nothing else', async () => {
  await saveCustomPuzzle(mine('m-a', 1));
  await saveProgress({ levels: { 'custom/m-a': { solved: true, solution: 'x' }, 'trainyard/redLine': { solved: true, solution: 'y' } } });
  await deleteCustomPuzzle('m-a');
  expect(await listCustomPuzzles()).toEqual([]);
  expect(Object.keys((await loadProgress()).levels)).toEqual(['trainyard/redLine']);
});

test('a storage failure lists nothing', async () => {
  vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(await listCustomPuzzles()).toEqual([]);
});

test('a new name that is already taken gets a number', () => {
  expect(uniqueName('Hard #12', ['Easy #12'])).toBe('Hard #12');
  expect(uniqueName('Hard #12', ['Hard #12'])).toBe('Hard #12 (2)');
  expect(uniqueName('Hard #12', ['Hard #12', 'Hard #12 (2)'])).toBe('Hard #12 (3)');
});
