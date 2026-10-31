import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, expect, test } from 'vitest';
import { loadOriginalTheme } from '../../src/app/theme/original/index.ts';

beforeEach(() => clear(createStore('trainyard', 'kv')));

test('without the art stored there is no Original theme, so the app keeps the default', async () => {
  expect(await loadOriginalTheme()).toBeNull();
});

test('art that is stored but unreadable counts as missing, so Settings offers to load it again', async () => {
  const { set } = await import('idb-keyval');
  await set('theme/original/v1', { atlas: new Blob(['not a png'], { type: 'image/png' }), sounds: {} }, createStore('trainyard', 'kv'));
  const { resolveTheme } = await import('../../src/app/theme/original/index.ts');
  expect(await resolveTheme('original')).toEqual({ theme: null, available: false });
  expect((await resolveTheme('default')).theme).toBeNull();
});
