import { afterEach, expect, test, vi } from 'vitest';

const synth = vi.hoisted(() => vi.fn());
vi.mock('../../src/app/theme/sound.ts', () => ({ synthSound: synth, audioContext: () => null }));

const { decodeSounds, deliverFile, originalPlayer, SOUND_FILES } = await import('../../src/app/theme/original/sounds.ts');

afterEach(() => synth.mockReset());

test('decodeSounds keeps the sounds that decode and skips the rest', async () => {
  const buffer = {} as AudioBuffer;
  const decode = vi.fn(async (b: ArrayBuffer) => {
    if (b.byteLength === 1) throw new DOMException('bad', 'EncodingError');
    return buffer;
  });
  const out = await decodeSounds({ Game_Crash: new Blob([new Uint8Array(2)]), Game_Paint: new Blob([new Uint8Array(1)]) }, decode);
  expect(out).toEqual({ Game_Crash: buffer });
});

test('a sound with no decoded file falls back to the synthesized one', () => {
  originalPlayer({})('crash');
  originalPlayer({})('deliver', 3);
  expect(synth.mock.calls).toEqual([['crash', undefined], ['deliver', 3]]);
});

test('sound files follow the original names', () => {
  expect(deliverFile(6)).toBe('Game_Train_7');
  expect(deliverFile(0)).toBe('Game_Train_1');
  expect(SOUND_FILES.win).toBe('GameUI_Win');
  expect(SOUND_FILES.start).toBe('UI_StartGame');
});

test('a decoded sound plays instead of the synthesized one, silently until audio is unlocked', () => {
  expect(() => originalPlayer({ Game_Crash: {} as AudioBuffer })('crash')).not.toThrow();
  expect(synth).not.toHaveBeenCalled();
});

test('each sound is ready as soon as it decodes, even while another never finishes', async () => {
  const buffer = {} as AudioBuffer;
  const decode = (b: ArrayBuffer) => (b.byteLength === 1 ? new Promise<AudioBuffer>(() => {}) : Promise.resolve(buffer));
  const into: Record<string, AudioBuffer> = {};
  void decodeSounds({ Game_Crash: new Blob([new Uint8Array(2)]), Game_Paint: new Blob([new Uint8Array(1)]) }, decode, into);
  await vi.waitFor(() => expect(into).toEqual({ Game_Crash: buffer }));
});
