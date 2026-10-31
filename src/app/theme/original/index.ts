import { loadSettings, saveSettings } from '../../settings.ts';
import { loadThemeAssets } from '../../store.ts';
import type { Theme } from '../theme.ts';
import { canvasSprites, originalDrawing } from './draw.ts';
import { decodeSounds, originalPlayer } from './sounds.ts';

interface Loaded { theme: Theme; startSounds: () => void }

/**
 * The Original theme, built from the art and sounds kept when the APK was loaded. Null when they
 * aren't stored or can't be read, and the app keeps the default theme. The sounds decode in the
 * background once `startSounds` is called; until each is ready, or if it can't be decoded, its
 * synthesized sound plays instead.
 */
async function load(): Promise<Loaded | null> {
  try {
    const assets = await loadThemeAssets();
    if (!assets) return null;
    const atlas = await createImageBitmap(assets.atlas);
    const buffers: Record<string, AudioBuffer> = {};
    let started = false;
    const startSounds = () => {
      if (started) return;
      started = true;
      try {
        // decoded buffers play in any audio context, so decode without waiting for a tap
        const offline = new OfflineAudioContext(1, 1, 44100);
        void decodeSounds(assets.sounds, (b) => offline.decodeAudioData(b), buffers);
      } catch {
        // no Web Audio: every sound stays synthesized
      }
    };
    const theme: Theme = { id: 'original', name: 'Original', ...originalDrawing(canvasSprites(atlas)), playSound: originalPlayer(buffers) };
    return { theme, startSounds };
  } catch {
    return null;
  }
}

// Read once and kept, so switching styles doesn't decode the art again.
let loaded: Promise<Loaded | null> | null = null;
const original = () => (loaded ??= load());

/** Drops the kept theme, so the next use reads the art again: call after loading a new APK. */
export function forgetOriginalTheme(): void {
  loaded = null;
}

export async function loadOriginalTheme(): Promise<Theme | null> {
  return (await original())?.theme ?? null;
}

/**
 * The theme to show for a choice (null means the default), and whether Settings can offer Original.
 * Art that is stored but unreadable counts as missing either way. If Original can't load, the saved
 * choice goes back to Default, so the next launch doesn't try again.
 */
export async function resolveTheme(id: 'default' | 'original'): Promise<{ theme: Theme | null; available: boolean }> {
  const o = await original();
  if (id === 'default') return { theme: null, available: o !== null };
  if (!o) {
    saveSettings({ ...loadSettings(), theme: 'default' });
    return { theme: null, available: false };
  }
  o.startSounds();
  return { theme: o.theme, available: true };
}
