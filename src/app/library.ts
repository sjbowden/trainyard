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

/** The featured sets, then the bands, each only if it has puzzles. */
export function groupSummaries(lib: LibraryPuzzle[], progress: Progress): { group: LibraryGroup; label: string; count: number; solved: number }[] {
  const groups: LibraryGroup[] = [...FEATURED_SETS.map((set) => ({ kind: 'featured', set }) as const), ...BANDS.map((_, band) => ({ kind: 'band', band }) as const)];
  return groups
    .map((group) => {
      const ps = lib.filter((p) => inGroup(p, group));
      return { group, label: groupLabel(group), count: ps.length, solved: ps.filter((p) => progress.levels[libraryKey(p.id)]?.solved).length };
    })
    .filter((s) => s.count > 0);
}

/** The puzzle after this one in its list, or undefined at the end. */
export function nextInGroup(lib: LibraryPuzzle[], g: LibraryGroup, sort: LibrarySort, id: string): LibraryPuzzle | undefined {
  const list = groupPuzzles(lib, g, sort);
  const i = list.findIndex((p) => p.id === id);
  return i < 0 ? undefined : list[i + 1];
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
