import type { Color } from '../../engine/types.ts';
import type { SoundKind } from './theme.ts';

/** Short synthesized sounds for the default theme. iOS only allows audio after a tap. */

let ctx: AudioContext | null = null;

/** Call from a tap handler so iOS lets the page play sound. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08, slideTo?: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

// One pitch per train color, a pentatonic-ish set so deliveries sound musical together.
const COLOR_PITCH = [523, 587, 659, 784, 880, 988, 440];

export function synthSound(kind: SoundKind, color?: Color): void {
  switch (kind) {
    case 'draw': return tone(900, 0.04, 'triangle', 0.03);
    case 'erase': return tone(300, 0.06, 'triangle', 0.04, 200);
    case 'switch': return tone(1200, 0.05, 'square', 0.03);
    case 'paint': return tone(700, 0.12, 'sine', 0.05, 1000);
    case 'split': return tone(500, 0.12, 'triangle', 0.05, 800);
    case 'crash': return tone(160, 0.35, 'sawtooth', 0.08, 50);
    case 'deliver': return tone(COLOR_PITCH[color ?? 0]!, 0.25, 'sine', 0.08);
    case 'start': return tone(440, 0.1, 'triangle', 0.05, 660);
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.07), i * 110));
  }
}
