import type { Collection, Level } from '../data/apk.ts';
import { isWorldUnlocked, type Progress } from './progress.ts';

/** The level after this one in its city, or the first of the next city if that city is unlocked. */
export function nextLevel(c: Collection, slug: string, p: Progress): Level | undefined {
  const order = c.worlds.flatMap((w) => c.levels.filter((l) => l.worldSlug === w.slug).sort((a, b) => a.ordinal - b.ordinal));
  const next = order[order.findIndex((l) => l.slug === slug) + 1];
  return next && isWorldUnlocked(c, next.worldSlug, p) ? next : undefined;
}
