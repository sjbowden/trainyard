import { loadThemeAssets } from '../../store.ts';
import type { Theme } from '../theme.ts';
import { canvasSprites, originalDrawing } from './draw.ts';
import { decodeSounds, originalPlayer } from './sounds.ts';

/**
 * The Original theme, built from the art and sounds kept when the APK was loaded. Null when they
 * aren't stored or can't be read, and the app keeps the default theme. Sounds decode in the
 * background; until each is ready, or if it can't be decoded, its synthesized sound plays instead.
 */
export async function loadOriginalTheme(): Promise<Theme | null> {
  try {
    const assets = await loadThemeAssets();
    if (!assets) return null;
    const atlas = await createImageBitmap(assets.atlas);
    const buffers: Record<string, AudioBuffer> = {};
    try {
      // decoded buffers play in any audio context, so decode without waiting for a tap
      const offline = new OfflineAudioContext(1, 1, 44100);
      void decodeSounds(assets.sounds, (b) => offline.decodeAudioData(b)).then((decoded) => Object.assign(buffers, decoded));
    } catch {
      // no Web Audio: every sound stays synthesized
    }
    return { id: 'original', name: 'Original', ...originalDrawing(canvasSprites(atlas)), playSound: originalPlayer(buffers) };
  } catch {
    return null;
  }
}

/** Whether the Original theme's art is stored, so Settings can offer it. */
export async function hasOriginalTheme(): Promise<boolean> {
  return (await loadThemeAssets()) !== null;
}
