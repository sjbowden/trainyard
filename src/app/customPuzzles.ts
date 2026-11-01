import { encodeShare, type SharedPuzzle } from './share.ts';
import { forgetProgress, readStored, updateStored } from './store.ts';

/** Puzzles made in the editor ("mine") or added from a share link ("shared"), kept on the device. */

export interface CustomPuzzle {
  /** 'm-<random>' for mine; 's-<checksum of the link>' for shared, so the same link isn't added twice. */
  id: string;
  source: 'mine' | 'shared' | 'generated';
  name: string;
  /** A puzzle-only code. */
  code: string;
  /** For mine: a solution half that solves this exact code, or null until the author solves it. */
  proof: string | null;
  created: number;
  /** A note shown above the puzzle, e.g. that a generated puzzle may be easier than asked. */
  note?: string;
}

const KEY = 'custom/v1';

/** Progress for a custom puzzle is kept under this key. */
export const customKey = (id: string) => `custom/${id}`;

export async function listCustomPuzzles(): Promise<CustomPuzzle[]> {
  const list = await readStored<CustomPuzzle[]>(KEY, []);
  return [...list].sort((a, b) => b.created - a.created);
}

export function saveCustomPuzzle(p: CustomPuzzle): Promise<void> {
  return updateStored<CustomPuzzle[]>(KEY, (old = []) => [...old.filter((x) => x.id !== p.id), p]);
}

/** A shared puzzle's id comes from its code alone, so the same puzzle is never added twice. */
export const sharedId = (code: string) => `s-${encodeShare({ name: '', code }).slice(-8)}`;

export async function addShared(s: SharedPuzzle): Promise<CustomPuzzle> {
  const list = await listCustomPuzzles();
  const same = list.find((p) => p.source === 'shared' && p.code === s.code);
  if (same) return same;
  // a different puzzle with the same short id (very unlikely) gets its own id
  const base = sharedId(s.code);
  const id = list.some((p) => p.id === base) ? `${base}-${Date.now().toString(36)}` : base;
  const p: CustomPuzzle = { id, source: 'shared', name: s.name, code: s.code, proof: null, created: Date.now() };
  await saveCustomPuzzle(p);
  return p;
}

export async function deleteCustomPuzzle(id: string): Promise<void> {
  await updateStored<CustomPuzzle[]>(KEY, (old = []) => old.filter((p) => p.id !== id));
  await forgetProgress(customKey(id));
}

export function newPuzzleId(): string {
  return `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The name, or with " (2)", " (3)"… added if another puzzle already has it. */
export function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}
