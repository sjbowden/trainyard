import { FEATURED_SETS, type LibraryPuzzle } from '../data/library.ts';
import type { Progress } from './progress.ts';

/** Browsing the player puzzle library: its featured sets and difficulty bands. All pure. */

export type LibraryGroup = { kind: 'featured'; set: string } | { kind: 'band'; band: number };
export type LibrarySort = 'likes' | 'solves';

/** Wrench ranges. Exact counts would give 28 lopsided groups. */
export const BANDS: { from: number; to: number }[] = [
  { from: 1, to: 5 },
  { from: 6, to: 10 },
  { from: 11, to: 17 },
  { from: 18, to: 24 },
  { from: 25, to: 30 },
];

/** Progress for a library puzzle is kept under this key. */
export const libraryKey = (id: string) => `library/${id}`;

function inGroup(p: LibraryPuzzle, g: LibraryGroup): boolean {
  if (g.kind === 'featured') return p.featured?.set === g.set;
  const b = BANDS[g.band]!;
  return p.wrenches >= b.from && p.wrenches <= b.to;
}

/** A group's puzzles in list order: a featured set in the site's order, a band by the sort, most first, then by name and id. */
export function groupPuzzles(lib: LibraryPuzzle[], g: LibraryGroup, sort: LibrarySort): LibraryPuzzle[] {
  const ps = lib.filter((p) => inGroup(p, g));
  if (g.kind === 'featured') return ps.sort((a, b) => a.featured!.order - b.featured!.order);
  return ps.sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function groupLabel(g: LibraryGroup): string {
  if (g.kind === 'featured') return g.set;
  const b = BANDS[g.band]!;
  return `${b.from}–${b.to} wrenches`;
}

/** Every group in browsing order: the featured sets, then the bands, each only if it has puzzles. */
function groupsInOrder(lib: LibraryPuzzle[]): LibraryGroup[] {
  const groups: LibraryGroup[] = [...FEATURED_SETS.map((set) => ({ kind: 'featured', set }) as const), ...BANDS.map((_, band) => ({ kind: 'band', band }) as const)];
  return groups.filter((g) => lib.some((p) => inGroup(p, g)));
}

export function groupSummaries(lib: LibraryPuzzle[], progress: Progress): { group: LibraryGroup; label: string; count: number; solved: number }[] {
  return groupsInOrder(lib).map((group) => {
    const ps = lib.filter((p) => inGroup(p, group));
    return { group, label: groupLabel(group), count: ps.length, solved: ps.filter((p) => progress.levels[libraryKey(p.id)]?.solved).length };
  });
}

/**
 * The puzzle Next opens: the one after this in its list, or else the first in the following group,
 * passing over any that `skip` says to. Undefined after the last group.
 */
export function nextPuzzle(lib: LibraryPuzzle[], g: LibraryGroup, sort: LibrarySort, id: string, skip: (id: string) => boolean = () => false): { puzzle: LibraryPuzzle; group: LibraryGroup } | undefined {
  const at = groupPuzzles(lib, g, sort).findIndex((p) => p.id === id);
  if (at < 0) return undefined;
  const groups = groupsInOrder(lib);
  const from = groups.findIndex((x) => groupSlug(x) === groupSlug(g));
  for (let i = from; i < groups.length; i++) {
    const group = groups[i]!;
    const puzzle = groupPuzzles(lib, group, sort).slice(i === from ? at + 1 : 0).find((p) => !skip(p.id));
    if (puzzle) return { puzzle, group };
  }
  return undefined;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Puzzles whose name or creator holds every word of the query, ignoring capitals and accents, most liked first. */
export function searchLibrary(lib: LibraryPuzzle[], query: string): LibraryPuzzle[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return lib
    .filter((p) => {
      const text = fold(`${p.name} ${p.creator}`);
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Where a search result opens: its featured set, or else its band (the nearest one, for a count outside them all). */
export function homeGroup(p: LibraryPuzzle): LibraryGroup {
  if (p.featured && FEATURED_SETS.includes(p.featured.set)) return { kind: 'featured', set: p.featured.set };
  const band = BANDS.findIndex((b) => p.wrenches <= b.to);
  return { kind: 'band', band: band < 0 ? BANDS.length - 1 : band };
}

/** For routes: `f-<set>` or `w-<band>`. */
export function groupSlug(g: LibraryGroup): string {
  return g.kind === 'featured' ? `f-${g.set}` : `w-${g.band}`;
}

export function parseGroupSlug(s: string): LibraryGroup | null {
  if (s.startsWith('f-') && FEATURED_SETS.includes(s.slice(2))) return { kind: 'featured', set: s.slice(2) };
  const m = /^w-(\d)$/.exec(s);
  return m && Number(m[1]) < BANDS.length ? { kind: 'band', band: Number(m[1]) } : null;
}

/** "by Matt · 7 🔧 · 3 likes", leaving out "by" when the creator has no name. */
export function creditLine(p: LibraryPuzzle): string {
  return [p.creator.trim() && `by ${p.creator}`, `${p.wrenches} 🔧`, `${p.likes} likes`].filter(Boolean).join(' · ');
}
