import { createStore, get, set, type UseStore } from 'idb-keyval';
import { readApk, readThemeAssets, type Collection } from '../data/apk.ts';
import { emptyProgress, type Progress } from './progress.ts';

/**
 * Everything kept on the device: the puzzles read from the player's APK, and their progress.
 * Storage can fail (private browsing, iOS clearing site data), so reads fall back to empty.
 */

const COLLECTIONS = 'collections/v1';
const PROGRESS = 'progress/v1';
const THEME = 'theme/original/v1';

/** The Original theme's art and sounds, as kept on the device. */
export interface StoredThemeAssets { atlas: Blob; sounds: Record<string, Blob> }

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

/**
 * Reads an APK and saves its puzzles, then the original's art and sounds. `saved` is false if the
 * phone wouldn't store the puzzles, `themeSaved` if it wouldn't store the art (the puzzles still count).
 */
export async function importApk(file: Blob, wasmUrl: string): Promise<{ collections: Collection[]; saved: boolean; themeSaved: boolean }> {
  let collections: Collection[];
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    collections = await readApk(bytes, { locateFile: () => wasmUrl });
  } catch (err) {
    if ((err as Error).message === 'Not a Trainyard APK') throw new Error("That file isn't a Trainyard APK.");
    throw new Error("Couldn't read the APK. Check your connection and try again.");
  }
  try {
    await withTimeout(set(COLLECTIONS, collections, store()));
  } catch {
    forget();
    return { collections, saved: false, themeSaved: false };
  }
  return { collections, saved: true, themeSaved: await saveThemeAssets(bytes) };
}

async function saveThemeAssets(bytes: Uint8Array): Promise<boolean> {
  try {
    const assets = readThemeAssets(bytes);
    if (!assets) return false;
    const stored: StoredThemeAssets = {
      atlas: new Blob([assets.atlas], { type: 'image/png' }),
      sounds: Object.fromEntries(Object.entries(assets.sounds).map(([k, v]) => [k, new Blob([v], { type: 'audio/ogg' })])),
    };
    await withTimeout(set(THEME, stored, store()));
    return true;
  } catch {
    forget();
    return false;
  }
}

export async function loadThemeAssets(): Promise<StoredThemeAssets | null> {
  try {
    return (await withTimeout(get<StoredThemeAssets>(THEME, store()))) ?? null;
  } catch {
    forget();
    return null;
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

/** Reads a stored value, or the fallback if there is none or storage fails. */
export async function readStored<T>(key: string, fallback: T): Promise<T> {
  try {
    return (await withTimeout(get<T>(key, store()))) ?? fallback;
  } catch {
    forget();
    return fallback;
  }
}

/**
 * Read-modify-write of one stored value, queued with every other write so overlapping
 * updates can't undo each other. Nothing is written if the stored value can't be read.
 */
export function updateStored<T>(key: string, change: (old: T | undefined) => T): Promise<void> {
  saving = saving.then(async () => {
    try {
      const kv = store();
      const old = await withTimeout(get<T>(key, kv));
      await withTimeout(set(key, change(old), kv));
    } catch {
      forget();
    }
  });
  return saving;
}

/** Removes one level's progress (used when a custom puzzle is deleted). */
export function forgetProgress(levelKey: string): Promise<void> {
  return updateStored<Progress>(PROGRESS, (old) => {
    const levels = { ...(old?.levels ?? {}) };
    delete levels[levelKey];
    return { levels };
  });
}
