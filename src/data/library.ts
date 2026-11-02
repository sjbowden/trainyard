import { decodeBoard } from '../engine/codec.ts';

/**
 * The library of player-made puzzles from trainyard.ca. A dev script builds one file from the
 * scrape; the player loads it onto the phone. Neither the file nor its codes are ever published.
 */

/** A puzzle as the scraper keeps it (local/library-raw.json). */
export interface ScrapedPuzzle {
  id: string;
  encodedID: string;
  name: string;
  creator: string;
  wrenches: number | null; // null for a featured puzzle the feeds didn't list
  likes: number | null;
  solves: number;
  featured?: { set: string; order: number };
  /** The puzzle code, or null when no solution could be read. */
  code: string | null;
}

export interface LibraryPuzzle {
  id: string;
  name: string;
  creator: string;
  wrenches: number;
  likes: number;
  solves: number;
  featured?: { set: string; order: number };
  /** A puzzle-only code. */
  code: string;
}

/** The featured sets, in the order trainyard.ca lists them. */
export const FEATURED_SETS: readonly string[] = ['Port Credit', 'Lorne Park', 'Cooksville', 'Erindale'];

const FORMAT = 'trainyard-library';
const VERSION = 1;

export class LibraryError extends Error {
  constructor(message = "That file isn't a Trainyard library.") {
    super(message);
    this.name = 'LibraryError';
  }
}

const decodes = (code: string) => {
  try {
    decodeBoard(code);
    return true;
  } catch {
    return false;
  }
};

/** The entry as a LibraryPuzzle, or null if a field is missing or its code won't decode. */
function check(e: unknown): LibraryPuzzle | null {
  if (typeof e !== 'object' || e === null) return null;
  const p = e as Record<string, unknown>;
  const strings = ['id', 'name', 'creator', 'code'].every((k) => typeof p[k] === 'string');
  const numbers = ['wrenches', 'likes', 'solves'].every((k) => Number.isFinite(p[k]));
  const f = p.featured as Record<string, unknown> | undefined;
  const featured = f === undefined || (typeof f === 'object' && f !== null && typeof f.set === 'string' && Number.isFinite(f.order));
  // a code carrying a solution would give the answer away
  if (!strings || !numbers || !featured || (p.code as string).includes('_') || !decodes(p.code as string)) return null;
  const { id, name, creator, wrenches, likes, solves, code } = p as unknown as LibraryPuzzle;
  return { id, name, creator, wrenches, likes, solves, ...(f ? { featured: { set: f.set as string, order: f.order as number } } : {}), code };
}

export function buildLibraryFile(raw: { puzzles: Record<string, ScrapedPuzzle> }): { text: string; kept: number; dropped: number } {
  const all = Object.values(raw.puzzles);
  const puzzles = all
    .map(({ encodedID: _, ...p }) => check({ ...p, wrenches: p.wrenches ?? 0, likes: p.likes ?? 0 }))
    .filter((p): p is LibraryPuzzle => p !== null);
  return { text: JSON.stringify({ format: FORMAT, version: VERSION, puzzles }), kept: puzzles.length, dropped: all.length - puzzles.length };
}

export function parseLibrary(text: string): { puzzles: LibraryPuzzle[]; dropped: number } {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new LibraryError();
  }
  const f = file as { format?: unknown; version?: unknown; puzzles?: unknown } | null;
  if (f?.format === FORMAT && typeof f.version === 'number' && f.version > VERSION) throw new LibraryError('This library file needs a newer version of the app.');
  if (f?.format !== FORMAT || f.version !== VERSION || !Array.isArray(f.puzzles)) throw new LibraryError();
  const ids = new Set<string>();
  // a repeated id would share a route and progress with the first: keep only the first
  const puzzles = f.puzzles.map(check).filter((p): p is LibraryPuzzle => p !== null && !ids.has(p.id) && !!ids.add(p.id));
  if (!puzzles.length) throw new LibraryError(); // nothing usable: keep whatever library is loaded
  return { puzzles, dropped: f.puzzles.length - puzzles.length };
}
