import 'fake-indexeddb/auto';
import { clear, createStore, get, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Progress } from '../../src/app/progress.ts';

// Two copies of the store module stand for two tabs: each has its own queue of saves.
const client = async () => {
  vi.resetModules();
  return import('../../src/app/store.ts');
};
const kv = () => createStore('trainyard', 'kv');

beforeEach(() => clear(kv()));
afterEach(() => vi.restoreAllMocks());

test('saves from two tabs at once both land', async () => {
  for (let i = 0; i < 10; i++) {
    await clear(kv());
    const [one, two] = [await client(), await client()];
    await Promise.all([
      one.saveProgress({ levels: { 'trainyard/a': { solved: true, solution: 'x', at: 1 } } }),
      two.saveProgress({ levels: { 'trainyard/b': { solved: true, solution: 'y', at: 1 } } }),
    ]);
    expect(Object.keys((await get<Progress>('progress/v1', kv()))!.levels).sort()).toEqual(['trainyard/a', 'trainyard/b']);
  }
});

test('custom puzzles saved from two tabs at once both land', async () => {
  vi.resetModules();
  const one = await import('../../src/app/customPuzzles.ts');
  vi.resetModules();
  const two = await import('../../src/app/customPuzzles.ts');
  const p = (id: string) => ({ id, source: 'mine' as const, name: id, code: 'hh', proof: null, created: 1 });
  await Promise.all([one.saveCustomPuzzle(p('m-1')), two.saveCustomPuzzle(p('m-2'))]);
  expect((await one.listCustomPuzzles()).map((x) => x.id).sort()).toEqual(['m-1', 'm-2']);
});

test('a stale session saving another puzzle keeps the newer track it never touched', async () => {
  await set('progress/v1', { levels: { 'trainyard/a': { solved: true, solution: 'new-track', at: 200 } } }, kv());
  const { saveProgress } = await client();
  await saveProgress({ levels: { 'trainyard/a': { solved: false, solution: 'old-track', at: 100 }, 'trainyard/b': { solved: true, solution: 'b', at: 300 } } });
  expect((await get<Progress>('progress/v1', kv()))!.levels).toEqual({
    'trainyard/a': { solved: true, solution: 'new-track', at: 200 },
    'trainyard/b': { solved: true, solution: 'b', at: 300 },
  });
});

test('saving a custom puzzle says whether it was saved', async () => {
  vi.resetModules();
  const { saveCustomPuzzle } = await import('../../src/app/customPuzzles.ts');
  const p = { id: 'm-1', source: 'mine' as const, name: 'x', code: 'hh', proof: null, created: 1 };
  expect(await saveCustomPuzzle(p)).toBe(true);
  vi.spyOn(indexedDB, 'open').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.resetModules();
  const blocked = await import('../../src/app/customPuzzles.ts');
  expect(await blocked.saveCustomPuzzle(p)).toBe(false);
});
