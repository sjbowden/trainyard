import type { Collection } from '../data/apk.ts';

/** The player's progress, per level. Stars come from the levels themselves. */

export interface LevelProgress {
  solved: boolean;
  /** The solution half of a code (the text after `_`). */
  solution: string;
}

export interface Progress {
  /** Keyed by `${collectionId}/${slug}`. */
  levels: Record<string, LevelProgress>;
}

export const emptyProgress = (): Progress => ({ levels: {} });

export function levelKey(collection: Collection['id'], slug: string): string {
  return `${collection}/${slug}`;
}

/** Stars from this collection's solved levels. Trainyard and Express keep separate totals. */
export function starsEarned(c: Collection, p: Progress): number {
  return c.levels.reduce((sum, l) => sum + (p.levels[levelKey(c.id, l.slug)]?.solved ? l.stars : 0), 0);
}

export function isWorldUnlocked(c: Collection, worldSlug: string, p: Progress): boolean {
  const world = c.worlds.find((w) => w.slug === worldSlug);
  return world !== undefined && starsEarned(c, p) >= world.starsToUnlock;
}

/** Progress without one level (used when a custom puzzle is deleted). */
export function withoutLevel(p: Progress, key: string): Progress {
  const levels = { ...p.levels };
  delete levels[key];
  return { levels };
}

/** Saves the latest solution; a level stays solved once it has been solved. */
export function recordAttempt(p: Progress, key: string, solution: string, solved: boolean): Progress {
  const was = p.levels[key]?.solved ?? false;
  return { levels: { ...p.levels, [key]: { solved: was || solved, solution } } };
}
