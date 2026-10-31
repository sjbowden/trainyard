import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, expect, test } from 'vitest';
import { loadOriginalTheme } from '../../src/app/theme/original/index.ts';

beforeEach(() => clear(createStore('trainyard', 'kv')));

test('without the art stored there is no Original theme, so the app keeps the default', async () => {
  expect(await loadOriginalTheme()).toBeNull();
});
