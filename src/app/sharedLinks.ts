import type { Collection } from '../data/apk.ts';
import { decodeShare, LinkError, type SharedPuzzle } from './share.ts';

/** Reads a puzzle from pasted text: a full share link (possibly with words around it) or a bare payload. */
export function parsePastedLink(text: string): SharedPuzzle {
  const fromUrl = /#\/s\/(\S+)/.exec(text)?.[1];
  const bare = /^\s*(\d+\.[A-Za-z0-9_-]+\.[0-9a-f]{8})\s*$/.exec(text)?.[1];
  const payload = fromUrl ?? bare;
  if (!payload) throw new LinkError("That isn't a puzzle link.");
  return decodeShare(payload);
}

/** Original puzzles are never accepted from links (they arrive only from the player's APK). */
export function checkNotOriginal(p: SharedPuzzle, collections: Collection[] | null): void {
  if (collections?.some((c) => c.levels.some((l) => l.code === p.code))) throw new LinkError("That's one of the original puzzles.");
}

/** True when running as the installed home-screen app rather than in Safari. */
export function isInstalledApp(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
