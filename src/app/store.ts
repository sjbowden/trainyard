import { createStore, get, set, update, type UseStore } from 'idb-keyval';
import { readApk, readThemeAssets, type Collection } from '../data/apk.ts';
import { parseLibrary, type LibraryPuzzle } from '../data/library.ts';
import { emptyProgress, type Progress } from './progress.ts';

/**
 * Everything kept on the device: the puzzles read from the player's APK, and their progress.
 * Storage can fail (private browsing, iOS clearing site data), so reads fall back to empty.
 */

const COLLECTIONS = 'collections/v1';
const PROGRESS = 'progress/v1';
const THEME = 'theme/original/v1';
const LIBRARY = 'library/v1';

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
    if (err instanceof Error && err.message === 'Not a Trainyard APK') throw new Error("That file isn't a Trainyard APK.");
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

/**
 * Reads a library file and keeps its puzzles. A file that isn't a library throws and leaves the
 * stored library alone. `saved` is false if the phone wouldn't store it (the puzzles still play).
 */
export async function importLibrary(file: Blob): Promise<{ puzzles: LibraryPuzzle[]; saved: boolean; dropped: number }> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error("Couldn't read the file. Check your connection and try again.");
  }
  const { puzzles, dropped } = parseLibrary(text);
  try {
    await withTimeout(set(LIBRARY, puzzles, store()));
    return { puzzles, saved: true, dropped };
  } catch {
    forget();
    return { puzzles, saved: false, dropped };
  }
}

export async function loadLibrary(): Promise<LibraryPuzzle[] | null> {
  try {
    return (await withTimeout(get<LibraryPuzzle[]>(LIBRARY, store()))) ?? null;
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
 * launch, or another tab, never overwrites earlier solves. A level stays solved once solved,
 * and keeps the newer track (an untimed track is the oldest). The read and the write are one
 * storage transaction, so a save from another tab can't land in between. If the stored record
 * can't be read, nothing is written.
 */
export function saveProgress(p: Progress): Promise<void> {
  saving = saving.then(() => mergeAndSave(p));
  return saving;
}

async function mergeAndSave(p: Progress): Promise<void> {
  try {
    const kv = store();
    await withTimeout(
      update<Progress>(
        PROGRESS,
        (old) => {
          const stored = old ?? emptyProgress();
          const levels = { ...stored.levels };
          for (const [key, l] of Object.entries(p.levels)) {
            const s = stored.levels[key];
            const newer = !s || (l.at ?? 0) >= (s.at ?? 0) ? l : s;
            levels[key] = { ...newer, solved: l.solved || (s?.solved ?? false) };
          }
          return { levels };
        },
        kv,
      ),
    );
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
 * Read-modify-write of one stored value in one storage transaction, queued with every other
 * write, so overlapping updates (from this tab or another) can't undo each other. Nothing is
 * written if the stored value can't be read. Resolves to whether it was saved.
 */
export function updateStored<T>(key: string, change: (old: T | undefined) => T): Promise<boolean> {
  const done = saving.then(async () => {
    try {
      await withTimeout(update<T>(key, change, store()));
      return true;
    } catch {
      forget();
      return false;
    }
  });
  saving = done.then(() => {});
  return done;
}

/** Removes one level's progress (used when a custom puzzle is deleted). */
export async function forgetProgress(levelKey: string): Promise<void> {
  await updateStored<Progress>(PROGRESS, (old) => {
    const levels = { ...(old?.levels ?? {}) };
    delete levels[levelKey];
    return { levels };
  });
}
