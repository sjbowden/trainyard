import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importApk, loadCollections, loadProgress, saveProgress } from '../../src/app/store.ts';

const wasmUrl = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm');
const apk = readdirSync('.').find((f) => f.endsWith('.apk'));

beforeEach(() => clear(createStore('trainyard', 'kv')));
afterEach(() => vi.restoreAllMocks());

describe.skipIf(!apk)('with an APK', () => {
  test('importApk saves collections that loadCollections returns', async () => {
    const imported = await importApk(new Blob([readFileSync(apk!)]), wasmUrl);
    expect(imported.saved).toBe(true);
    expect(imported.collections.map((c) => c.levels.length)).toEqual([165, 68]);
    const loaded = await loadCollections();
    expect(loaded?.[0]?.levels[0]?.slug).toBe('redLine');
  });

  test('importApk rejects a non-APK and keeps existing data', async () => {
    await importApk(new Blob([readFileSync(apk!)]), wasmUrl);
    await expect(importApk(new Blob(['not an apk']), wasmUrl)).rejects.toThrow("That file isn't a Trainyard APK.");
    expect((await loadCollections())?.length).toBe(2);
  });

  test('importApk still returns the puzzles when the phone will not save them', async () => {
    // storage refuses the write, as when the phone is out of space
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const imported = await importApk(new Blob([readFileSync(apk!)]), wasmUrl);
    expect(imported.saved).toBe(false);
    expect(imported.collections).toHaveLength(2);
  });
});

test('loadCollections returns null when nothing is stored', async () => {
  expect(await loadCollections()).toBeNull();
});

test('loadCollections returns null when storage throws', async () => {
  vi.spyOn(indexedDB, 'open').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(await loadCollections()).toBeNull();
  expect(await loadProgress()).toEqual({ levels: {} });
});

test('progress round-trips', async () => {
  const p = { levels: { 'trainyard/redLine': { solved: true, solution: '003QQQ00' } } };
  await saveProgress(p);
  expect(await loadProgress()).toEqual(p);
});
