import { encodeShare, type SharedPuzzle } from './share.ts';
import { forgetProgress, readStored, updateStored } from './store.ts';

/** Puzzles made in the editor ("mine") or added from a share link ("shared"), kept on the device. */

export interface CustomPuzzle {
  /** 'm-<random>' for mine; 's-<checksum of the link>' for shared, so the same link isn't added twice. */
  id: string;
  source: 'mine' | 'shared';
  name: string;
  /** A puzzle-only code. */
  code: string;
  /** For mine: a solution half that solves this exact code, or null until the author solves it. */
  proof: string | null;
  created: number;
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

export async function addShared(s: SharedPuzzle): Promise<CustomPuzzle> {
  const id = `s-${encodeShare({ name: '', code: s.code }).slice(-8)}`;
  const existing = (await listCustomPuzzles()).find((p) => p.id === id);
  if (existing) return existing;
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
