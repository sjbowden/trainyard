import type { Collection, Level } from '../data/apk.ts';
import { isWorldUnlocked, levelKey, type Progress } from './progress.ts';

/** Every level in play order: cities in order, then puzzles in order within each city. */
function playOrder(c: Collection): Level[] {
  return [...c.worlds]
    .sort((a, b) => a.ordinal - b.ordinal)
    .flatMap((w) => c.levels.filter((l) => l.worldSlug === w.slug).sort((a, b) => a.ordinal - b.ordinal));
}

/** The level after this one in its city, or the first of the next city if that city is unlocked. */
export function nextLevel(c: Collection, slug: string, p: Progress): Level | undefined {
  const order = playOrder(c);
  const next = order[order.findIndex((l) => l.slug === slug) + 1];
  return next && isWorldUnlocked(c, next.worldSlug, p) ? next : undefined;
}

/** Where Play starts: the first unsolved puzzle in an unlocked city. */
export function firstUnsolved(c: Collection, p: Progress): Level | undefined {
  return playOrder(c).find((l) => !p.levels[levelKey(c.id, l.slug)]?.solved && isWorldUnlocked(c, l.worldSlug, p));
}

/** True for the first puzzle of its city, where that city's tutorial is shown. */
export function firstOfCity(c: Collection, slug: string): boolean {
  const level = c.levels.find((l) => l.slug === slug);
  return level !== undefined && playOrder(c).find((l) => l.worldSlug === level.worldSlug) === level;
}
