import { createStore, get, set, type UseStore } from 'idb-keyval';
import { readApk, type Collection } from '../data/apk.ts';
import { emptyProgress, type Progress } from './progress.ts';

/**
 * Everything kept on the device: the puzzles read from the player's APK, and their progress.
 * Storage can fail (private browsing, iOS clearing site data), so reads fall back to empty.
 */

const COLLECTIONS = 'collections/v1';
const PROGRESS = 'progress/v1';

// One connection, reopened after a failure so a passing storage error isn't remembered.
let cached: UseStore | null = null;
const store = (): UseStore => (cached ??= createStore('trainyard', 'kv'));
const forget = () => {
  cached = null;
};

/** Progress saves run one at a time, so overlapping saves can't undo each other. */
let saving: Promise<void> = Promise.resolve();

/** Some WebKit versions never answer an IndexedDB open; treat that as a failure. */
const TIMEOUT_MS = 3000;
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Storage did not respond')), TIMEOUT_MS);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** Reads an APK and saves its puzzles. `saved` is false if the phone wouldn't store them. */
export async function importApk(file: Blob, wasmUrl: string): Promise<{ collections: Collection[]; saved: boolean }> {
  let collections: Collection[];
  try {
    collections = await readApk(new Uint8Array(await file.arrayBuffer()), { locateFile: () => wasmUrl });
  } catch (err) {
    if ((err as Error).message === 'Not a Trainyard APK') throw new Error("That file isn't a Trainyard APK.");
    throw new Error("Couldn't read the APK. Check your connection and try again.");
  }
  try {
    await withTimeout(set(COLLECTIONS, collections, store()));
    return { collections, saved: true };
  } catch {
    forget();
    return { collections, saved: false };
  }
}

export async function loadCollections(): Promise<Collection[] | null> {
  try {
    return (await withTimeout(get<Collection[]>(COLLECTIONS, store()))) ?? null;
  } catch {
    forget();
    return null;
  }
}

export async function loadProgress(): Promise<Progress> {
  try {
    return (await withTimeout(get<Progress>(PROGRESS, store()))) ?? emptyProgress();
  } catch {
    forget();
    return emptyProgress();
  }
}

/**
 * Saves progress merged into what is stored, so a session that couldn't read progress at
 * launch never overwrites earlier solves. A level stays solved once solved. If the stored
 * record can't be read, nothing is written.
 */
export function saveProgress(p: Progress): Promise<void> {
  saving = saving.then(() => mergeAndSave(p));
  return saving;
}

async function mergeAndSave(p: Progress): Promise<void> {
  try {
    const kv = store();
    const stored = (await withTimeout(get<Progress>(PROGRESS, kv))) ?? emptyProgress();
    const levels = { ...stored.levels };
    for (const [key, l] of Object.entries(p.levels)) levels[key] = { solved: l.solved || (stored.levels[key]?.solved ?? false), solution: l.solution };
    await withTimeout(set(PROGRESS, { levels }, kv));
  } catch {
    forget();
    // Nothing to do: progress for this session stays in memory.
  }
}
