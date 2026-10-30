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
