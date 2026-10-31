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
      void decodeSounds(assets.sounds, (b) => offline.decodeAudioData(b), buffers);
    } catch {
      // no Web Audio: every sound stays synthesized
    }
    return { id: 'original', name: 'Original', ...originalDrawing(canvasSprites(atlas)), playSound: originalPlayer(buffers) };
  } catch {
    return null;
  }
}

/**
 * The theme to show for a choice (null means the default), and whether Settings can offer Original.
 * Choosing Original tries to load it, so art that is stored but unreadable counts as missing.
 */
export async function resolveTheme(id: 'default' | 'original'): Promise<{ theme: Theme | null; available: boolean }> {
  if (id === 'default') return { theme: null, available: (await loadThemeAssets()) !== null };
  const theme = await loadOriginalTheme();
  return { theme, available: theme !== null };
}
