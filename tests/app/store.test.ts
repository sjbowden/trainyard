import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importApk, importLibrary, loadCollections, loadLibrary, loadProgress, loadThemeAssets, saveProgress } from '../../src/app/store.ts';
import { libraryText, puzzle } from './libraryFixture.ts';

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
    expect(imported.themeSaved).toBe(false);
    expect(imported.collections).toHaveLength(2);
  });

  test('importApk keeps the original art and sounds', async () => {
    const imported = await importApk(new Blob([readFileSync(apk!)]), wasmUrl);
    expect(imported.themeSaved).toBe(true);
    const assets = await loadThemeAssets();
    expect(assets?.atlas.type).toBe('image/png');
    expect(assets?.sounds.Game_Crash?.type).toBe('audio/ogg');
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

test('loadThemeAssets returns null when nothing is stored', async () => {
  expect(await loadThemeAssets()).toBeNull();
});

test('progress round-trips', async () => {
  const p = { levels: { 'trainyard/redLine': { solved: true, solution: '003QQQ00' } } };
  await saveProgress(p);
  expect(await loadProgress()).toEqual(p);
});

test('saving progress keeps when each track was laid', async () => {
  const p = { levels: { 'trainyard/redLine': { solved: true, solution: '003QQQ00', at: 1234 } } };
  await saveProgress(p);
  expect(await loadProgress()).toEqual(p);
});

test('a file that cannot be read gives the friendly message', async () => {
  const unreadable = { arrayBuffer: () => Promise.reject(new DOMException('not downloaded', 'NotReadableError')) } as unknown as Blob;
  await expect(importApk(unreadable, wasmUrl)).rejects.toThrow("Couldn't read the APK. Check your connection and try again.");
});

test('a read that fails with no error at all still gives the friendly message', async () => {
  const unreadable = { arrayBuffer: () => Promise.reject(undefined) } as unknown as Blob;
  await expect(importApk(unreadable, wasmUrl)).rejects.toThrow("Couldn't read the APK. Check your connection and try again.");
});

describe('the library', () => {
  test('importLibrary keeps the library and loadLibrary returns it', async () => {
    const lib = [puzzle('1'), puzzle('2', { name: 'Two' })];
    const imported = await importLibrary(new Blob([libraryText(lib)]));
    expect(imported).toEqual({ puzzles: lib, saved: true, dropped: 0 });
    expect(await loadLibrary()).toEqual(lib);
  });

  test("importLibrary refuses a file that isn't a library and keeps the one already stored", async () => {
    await importLibrary(new Blob([libraryText([puzzle('1')])]));
    await expect(importLibrary(new Blob(['PK\u0003\u0004 an apk']))).rejects.toThrow("That file isn't a Trainyard library.");
    expect((await loadLibrary())?.map((p) => p.id)).toEqual(['1']);
  });

  test('an unreadable library file gives the friendly message', async () => {
    const unreadable = { text: () => Promise.reject(undefined) } as unknown as Blob;
    await expect(importLibrary(unreadable)).rejects.toThrow("Couldn't read the file. Check your connection and try again.");
  });

  test("importLibrary still returns the puzzles when the phone won't save them", async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const imported = await importLibrary(new Blob([libraryText([puzzle('1')])]));
    expect(imported.saved).toBe(false);
    expect(imported.puzzles).toHaveLength(1);
  });

  test('loadLibrary returns null when nothing is stored', async () => {
    expect(await loadLibrary()).toBeNull();
  });
});

test('a library file whose puzzles all fail the check is refused, and the stored library stays', async () => {
  await importLibrary(new Blob([libraryText([puzzle('1')])]));
  await expect(importLibrary(new Blob([libraryText([puzzle('2', { code: 'zz!' })])]))).rejects.toThrow("That file isn't a Trainyard library.");
  await expect(importLibrary(new Blob([libraryText([])]))).rejects.toThrow("That file isn't a Trainyard library.");
  expect((await loadLibrary())?.map((p) => p.id)).toEqual(['1']);
});
