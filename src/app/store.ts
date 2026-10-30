import { createStore, get, set, type UseStore } from 'idb-keyval';
import { readApk, type Collection } from '../data/apk.ts';
import { emptyProgress, type Progress } from './progress.ts';

/**
 * Everything kept on the device: the puzzles read from the player's APK, and their progress.
 * Storage can fail (private browsing, iOS clearing site data), so reads fall back to empty.
 */

const COLLECTIONS = 'collections/v1';
const PROGRESS = 'progress/v1';

// Opened per call, so a storage failure is seen on every call rather than cached.
const store = (): UseStore => createStore('trainyard', 'kv');

export async function importApk(file: Blob, wasmUrl: string): Promise<Collection[]> {
  let collections: Collection[];
  try {
    collections = await readApk(new Uint8Array(await file.arrayBuffer()), { locateFile: () => wasmUrl });
  } catch {
    throw new Error("That file isn't a Trainyard APK.");
  }
  await set(COLLECTIONS, collections, store());
  return collections;
}

export async function loadCollections(): Promise<Collection[] | null> {
  try {
    return (await get<Collection[]>(COLLECTIONS, store())) ?? null;
  } catch {
    return null;
  }
}

export async function loadProgress(): Promise<Progress> {
  try {
    return (await get<Progress>(PROGRESS, store())) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export async function saveProgress(p: Progress): Promise<void> {
  try {
    await set(PROGRESS, p, store());
  } catch {
    // Nothing to do: progress for this session stays in memory.
  }
}
