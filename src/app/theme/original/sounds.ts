import type { Color } from '../../../engine/types.ts';
import { audioContext, synthSound } from '../sound.ts';
import type { SoundKind } from '../theme.ts';

/** The original's sound files (in the APK's assets/audio, without `.ogg`) for each kind of sound. */
export const SOUND_FILES: Record<Exclude<SoundKind, 'deliver'>, string> = {
  draw: 'Game_DrawTrack',
  erase: 'Game_EraseTrack',
  switch: 'Game_SwitchTrack',
  paint: 'Game_Paint',
  split: 'Game_Splitter',
  crash: 'Game_Crash',
  start: 'UI_StartGame',
  win: 'GameUI_Win',
};

/** Each train color has its own delivery chime. */
export const deliverFile = (color: Color): string => `Game_Train_${color + 1}`;

/** Decodes what it can; a file the browser can't decode is left out, and its sound falls back. */
export async function decodeSounds(blobs: Record<string, Blob>, decode: (b: ArrayBuffer) => Promise<AudioBuffer>): Promise<Record<string, AudioBuffer>> {
  const out: Record<string, AudioBuffer> = {};
  await Promise.all(
    Object.entries(blobs).map(async ([name, blob]) => {
      try {
        out[name] = await decode(await blob.arrayBuffer());
      } catch {
        // e.g. a browser without Ogg Vorbis
      }
    }),
  );
  return out;
}

export function originalPlayer(buffers: Record<string, AudioBuffer>): (kind: SoundKind, color?: Color) => void {
  return (kind, color) => {
    const buffer = buffers[kind === 'deliver' ? deliverFile(color ?? 0) : SOUND_FILES[kind]];
    if (!buffer) return synthSound(kind, color);
    const ctx = audioContext();
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };
}
