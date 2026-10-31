import 'fake-indexeddb/auto';
import { clear, createStore, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { forgetOriginalTheme, loadOriginalTheme, resolveTheme } from '../../src/app/theme/original/index.ts';
import { loadSettings, saveSettings } from '../../src/app/settings.ts';

// The test environment can't decode images or audio, so stand in for the browser, which decodes
// the stored atlas only when the test says it is readable.
let readable = true;
let bitmaps = 0;
let audioContexts = 0;
beforeEach(async () => {
  await clear(createStore('trainyard', 'kv'));
  forgetOriginalTheme();
  bitmaps = 0;
  audioContexts = 0;
  vi.stubGlobal('createImageBitmap', async () => {
    bitmaps++;
    if (!readable) throw new Error('not an image');
    return {};
  });
  const ctx = new Proxy({}, { get: () => () => {} });
  vi.stubGlobal('OffscreenCanvas', class { getContext() { return ctx; } });
  vi.stubGlobal('OfflineAudioContext', class {
    constructor() { audioContexts++; }
    decodeAudioData() { return new Promise(() => {}); }
  });
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const storeArt = (atlas: 'png' | 'not a png') => {
  readable = atlas === 'png';
  return set('theme/original/v1', { atlas: new Blob([atlas], { type: 'image/png' }), sounds: { Game_Train_1: new Blob(['ogg']) } }, createStore('trainyard', 'kv'));
};

test('without the art stored there is no Original theme, so the app keeps the default', async () => {
  expect(await loadOriginalTheme()).toBeNull();
  expect(await resolveTheme('default')).toEqual({ theme: null, available: false });
});

test('art that is stored but unreadable counts as missing, whichever style is chosen', async () => {
  await storeArt('not a png');
  expect(await resolveTheme('default')).toEqual({ theme: null, available: false });
  expect(await resolveTheme('original')).toEqual({ theme: null, available: false });
});

test('readable art makes Original available from Default, and the theme once chosen', async () => {
  await storeArt('png');
  expect(await resolveTheme('default')).toEqual({ theme: null, available: true });
  const chosen = await resolveTheme('original');
  expect(chosen.available).toBe(true);
  expect(chosen.theme?.id).toBe('original');
});

test('the art is read once, however often the style is switched, until a new APK is loaded', async () => {
  await storeArt('png');
  for (const id of ['default', 'original', 'default', 'original'] as const) await resolveTheme(id);
  expect(bitmaps).toBe(1);
  forgetOriginalTheme();
  await resolveTheme('original');
  expect(bitmaps).toBe(2);
});

test('the sounds decode only once Original is chosen, and only once', async () => {
  await storeArt('png');
  await resolveTheme('default');
  expect(audioContexts).toBe(0);
  await resolveTheme('original');
  await resolveTheme('original');
  expect(audioContexts).toBe(1);
});

test('when Original cannot load, the saved choice goes back to Default', async () => {
  saveSettings({ ...loadSettings(), theme: 'original' });
  await storeArt('not a png');
  await resolveTheme('original');
  expect(loadSettings().theme).toBe('default');
});
