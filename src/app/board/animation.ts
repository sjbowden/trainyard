import type { Side } from '../../engine/types.ts';
import { cellCenter, type Layout } from './geometry.ts';

/** Train timing and motion, matching the original's clock. */

/** The original runs one half-step every half second of game time at speed 1. */
export const HALF_STEP_SECONDS = 0.5;

/** The original's speed slider curve; t in [0, 1]. The middle (0.5) gives speed 3. */
export function speedFromSlider(t: number): number {
  return 2 ** (4 * t) - 1;
}

const DIR: Record<Side, { x: number; y: number }> = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };

/**
 * Where a train is drawn: progress 0 is the entry edge, 0.5 the center, 1 the exit edge.
 * Straight tracks are lines; corners are quarter circles around the corner the two sides share.
 */
export function trainPose(cell: number, entry: Side, exit: Side, progress: number, l: Layout): { x: number; y: number; angle: number } {
  const c = cellCenter(l, cell);
  const half = l.cell / 2;
  const a = DIR[entry];
  const b = DIR[exit];
  const start = { x: c.x + a.x * half, y: c.y + a.y * half };
  const end = { x: c.x + b.x * half, y: c.y + b.y * half };
  if (a.x === -b.x && a.y === -b.y) {
    return { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress, angle: Math.atan2(end.y - start.y, end.x - start.x) };
  }
  const corner = { x: c.x + (a.x + b.x) * half, y: c.y + (a.y + b.y) * half };
  const a0 = Math.atan2(start.y - corner.y, start.x - corner.x);
  let delta = Math.atan2(end.y - corner.y, end.x - corner.x) - a0;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  const angle = a0 + delta * progress;
  return { x: corner.x + Math.cos(angle) * half, y: corner.y + Math.sin(angle) * half, angle: angle + Math.sign(delta) * (Math.PI / 2) };
}
