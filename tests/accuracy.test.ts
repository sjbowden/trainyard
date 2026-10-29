// Replays real trainyard.ca solutions of the original puzzles. Needs local/collections.json
// (npm run extract) and fixtures/solutions.json (npm run scrape:fixtures); skipped without them.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Collection } from '../src/data/apk.ts';
import { decodeBoard } from '../src/engine/codec.ts';
import { simulate, trackCount } from '../src/engine/sim.ts';

const COLLECTIONS = 'local/collections.json';
const FIXTURES = 'fixtures/solutions.json';
const ready = existsSync(COLLECTIONS) && existsSync(FIXTURES);

/**
 * trainyard.ca records whose stored step count is wrong. Each still wins with the stored
 * track count. Five claim 1 step, shorter than any route on their boards. purpablu 2hGJd
 * claims 8, but its purple train needs 12 (8 is when the blue train arrives).
 */
const BAD_STEP_RECORDS = new Set(['2hQ7a', '2hGJd', '2bkBt', '2hUH6', '2hHYH', '2hWgX']);

describe.skipIf(!ready)('original puzzles replay their known solutions', () => {
  const collections: Collection[] = ready ? JSON.parse(readFileSync(COLLECTIONS, 'utf8')) : [];
  const fixtures: Record<string, { solution: string; trackCount: number; stepCount: number; source: string }[]> =
    ready ? JSON.parse(readFileSync(FIXTURES, 'utf8')) : {};
  const levels = collections.flatMap((c) => c.levels);

  const results = levels.flatMap((level) =>
    (fixtures[level.slug] ?? []).map((f) => {
      const board = decodeBoard(`${level.code}_${f.solution}`);
      const run = simulate(board);
      const tc = trackCount(board);
      return { slug: level.slug, source: f.source, outcome: run.outcome, steps: run.steps, wantSteps: f.stepCount, track: tc.major * 1000 + tc.minor, wantTrack: f.trackCount };
    }),
  );

  test('fixtures cover every original puzzle', () => {
    const missing = levels.filter((l) => !(fixtures[l.slug]?.length)).map((l) => l.slug);
    expect(missing).toEqual([]);
  });

  test('every solution wins', () => {
    expect(results.filter((r) => r.outcome !== 'won').map((r) => `${r.slug} (${r.source}): ${r.outcome}`)).toEqual([]);
  });

  test('step counts match', () => {
    expect(results.filter((r) => r.outcome === 'won' && r.steps !== r.wantSteps && !BAD_STEP_RECORDS.has(r.source)).map((r) => `${r.slug} (${r.source}): ${r.steps} vs ${r.wantSteps}`)).toEqual([]);
  });

  test('track counts match', () => {
    expect(results.filter((r) => r.track !== r.wantTrack).map((r) => `${r.slug} (${r.source}): ${r.track} vs ${r.wantTrack}`)).toEqual([]);
  });
});
