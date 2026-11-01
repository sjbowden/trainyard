import type { LevelProgress, Progress } from './progress.ts';

/**
 * A progress file, for moving solves between devices through iCloud Drive. It holds the
 * original puzzles and the player library; your own puzzles aren't in it, so neither is their
 * progress.
 */

const FORMAT = 'trainyard-progress';
const VERSION = 1;
const SHARED = /^(trainyard|express|library)\//;

export class ProgressFileError extends Error {
  constructor(message = "That file isn't a Trainyard progress file.") {
    super(message);
    this.name = 'ProgressFileError';
  }
}

export function progressFileText(p: Progress, now = new Date()): string {
  const levels = Object.fromEntries(Object.entries(p.levels).filter(([key]) => SHARED.test(key)));
  return JSON.stringify({ format: FORMAT, version: VERSION, saved: now.toISOString(), levels });
}

/** trainyard-progress-YYYY-MM-DD.json, by the phone's own date. */
export function progressFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `trainyard-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function check(e: unknown): LevelProgress | null {
  if (typeof e !== 'object' || e === null) return null;
  const l = e as Record<string, unknown>;
  if (typeof l.solved !== 'boolean' || typeof l.solution !== 'string' || (l.at !== undefined && !Number.isFinite(l.at))) return null;
  return { solved: l.solved, solution: l.solution, ...(l.at !== undefined ? { at: l.at as number } : {}) };
}

/** The file's progress, skipping entries it can't read. Throws ProgressFileError for any other file. */
export function parseProgressFile(text: string): Progress {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new ProgressFileError();
  }
  const f = file as { format?: unknown; version?: unknown; levels?: unknown } | null;
  if (f?.format === FORMAT && typeof f.version === 'number' && f.version > VERSION) throw new ProgressFileError('This progress file needs a newer version of the app.');
  if (f?.format !== FORMAT || f.version !== VERSION || typeof f.levels !== 'object' || f.levels === null) throw new ProgressFileError();
  const levels: Progress['levels'] = {};
  for (const [key, e] of Object.entries(f.levels)) {
    const l = check(e);
    if (l && SHARED.test(key)) levels[key] = l;
  }
  return { levels };
}

/**
 * This device's progress with another's: a puzzle solved on either is solved, and each keeps
 * the newer track (an untimed track is the oldest; a tie keeps this device's).
 */
export function mergeProgress(here: Progress, there: Progress): { progress: Progress; newlySolved: number } {
  const levels = { ...here.levels };
  let newlySolved = 0;
  for (const [key, t] of Object.entries(there.levels)) {
    const h = levels[key];
    if (t.solved && !h?.solved) newlySolved++;
    const newer = !h || (t.at ?? 0) > (h.at ?? 0) ? t : h;
    levels[key] = { ...newer, solved: t.solved || (h?.solved ?? false) };
  }
  return { progress: { levels }, newlySolved };
}
