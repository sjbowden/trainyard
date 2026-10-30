import 'fake-indexeddb/auto';
import { expect, test, vi } from 'vitest';

vi.mock('../../src/data/apk.ts', () => ({
  readApk: vi.fn(async (bytes: Uint8Array) => {
    if (bytes.length === 1) throw new Error('Not a Trainyard APK');
    throw new Error('failed to fetch sql-wasm.wasm'); // e.g. offline before the app was cached
  }),
}));

const { importApk } = await import('../../src/app/store.ts');

test('a wrong file is called the wrong file', async () => {
  await expect(importApk(new Blob([new Uint8Array([1])]), 'x.wasm')).rejects.toThrow("That file isn't a Trainyard APK.");
});

test('an APK that fails to read for another reason is not called the wrong file', async () => {
  await expect(importApk(new Blob([new Uint8Array([1, 2])]), 'x.wasm')).rejects.toThrow(/Couldn't read the APK/);
});
