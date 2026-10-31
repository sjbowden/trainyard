import { unzipSync } from 'fflate';
import initSqlJs, { type Database, type SqlJsConfig } from 'sql.js';

/** Reads the original puzzles out of a Trainyard or Trainyard Express APK. DOM-free. */

export interface World { slug: string; name: string; starsToUnlock: number; group: 'main' | 'bonus'; ordinal: number }
export interface Level { slug: string; worldSlug: string; name: string; stars: number; code: string; ordinal: number }
export interface Tutorial { slug: string; worldSlug: string; name: string; xml: string; ordinal: number }
export interface Collection { id: 'trainyard' | 'express'; worlds: World[]; levels: Level[]; tutorials: Tutorial[] }

const DATABASES = [
  { id: 'trainyard', path: 'assets/trainyardStatic.db' },
  { id: 'express', path: 'assets/trainyardExpressStatic.db' },
] as const;

function rows(db: Database, sql: string): Record<string, unknown>[] {
  const [result] = db.exec(sql);
  if (!result) return [];
  return result.values.map((v) => Object.fromEntries(result.columns.map((c, i) => [c, v[i]])));
}

function readCollection(db: Database, id: Collection['id']): Collection {
  const worlds = rows(db, 'SELECT slug, name, starsToUnlock, groupID, ordinal FROM worlds ORDER BY ordinal').map(
    (r): World => ({
      slug: String(r.slug),
      name: String(r.name),
      starsToUnlock: Number(r.starsToUnlock),
      group: Number(r.groupID) === 1 ? 'bonus' : 'main',
      ordinal: Number(r.ordinal),
    }),
  );
  const levels = rows(db, 'SELECT slug, worldSlug, name, stars, puzzle, ordinal FROM levels ORDER BY id').map(
    (r): Level => ({
      slug: String(r.slug),
      worldSlug: String(r.worldSlug),
      name: String(r.name),
      stars: Number(r.stars),
      code: String(r.puzzle),
      ordinal: Number(r.ordinal),
    }),
  );
  const tutorials = rows(db, 'SELECT slug, worldSlug, name, xml, ordinal FROM tutorials ORDER BY id').map(
    (r): Tutorial => ({
      slug: String(r.slug),
      worldSlug: String(r.worldSlug),
      name: String(r.name),
      xml: String(r.xml),
      ordinal: Number(r.ordinal),
    }),
  );
  return { id, worlds, levels, tutorials };
}

/** `sqlConfig` lets a browser say where to find sql.js's wasm file (its `locateFile`). */
export async function readApk(bytes: Uint8Array, sqlConfig?: SqlJsConfig): Promise<Collection[]> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => DATABASES.some((d) => d.path === f.name) });
  } catch {
    throw new Error('Not a Trainyard APK');
  }
  if (DATABASES.some((d) => !files[d.path])) throw new Error('Not a Trainyard APK');
  const SQL = await initSqlJs(sqlConfig);
  return DATABASES.map(({ id, path }) => {
    const db = new SQL.Database(files[path]);
    try {
      return readCollection(db, id);
    } finally {
      db.close();
    }
  });
}

/** The original's board art and sounds, for the Original theme. Sounds are keyed by file name without `.ogg`. */
export interface ThemeAssets { atlas: Uint8Array<ArrayBuffer>; sounds: Record<string, Uint8Array<ArrayBuffer>> }

const ATLAS = 'assets/FullAtlasHD.png';
const SOUND = /^assets\/audio\/(\w+)\.ogg$/;

/** Null when the atlas is missing, or the file isn't a zip. */
export function readThemeAssets(bytes: Uint8Array): ThemeAssets | null {
  // fflate unzips into fresh ArrayBuffers, never shared ones
  let files: Record<string, Uint8Array<ArrayBuffer>>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === ATLAS || SOUND.test(f.name) });
  } catch {
    return null;
  }
  const atlas = files[ATLAS];
  if (!atlas) return null;
  const sounds: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const [name, data] of Object.entries(files)) {
    const m = SOUND.exec(name);
    if (m) sounds[m[1]!] = data;
  }
  return { atlas, sounds };
}
