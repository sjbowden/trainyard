// Checks the solver against the original puzzles, using the committed calibration
// (npm run calibrate:solver) and the APK data. Skipped without local/collections.json.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { decodeBoard } from '../../src/engine/codec.ts';
import { simulate } from '../../src/engine/sim.ts';
import { solve } from '../../src/solver/solve.ts';

const ready = existsSync('local/collections.json') && existsSync('fixtures/solver-calibration.json');

describe.skipIf(!ready)('the solver on the original puzzles', () => {
  const levels = ready ? (JSON.parse(readFileSync('local/collections.json', 'utf8')) as Collection[]).flatMap((c) => c.levels) : [];
  const calibration: Record<string, { status: string; segments: number | null; nodes: number }> = ready ? JSON.parse(readFileSync('fixtures/solver-calibration.json', 'utf8')) : {};
  const players: Record<string, { trackCount: number }[]> = ready ? JSON.parse(readFileSync('fixtures/solutions.json', 'utf8')) : {};

  test('calibration covers every original', () => {
    expect(levels.filter((l) => !calibration[l.slug]).map((l) => l.slug)).toEqual([]);
  });

  test('quick solves re-solve to a winning track', () => {
    const quick = levels.filter((l) => calibration[l.slug]?.status === 'solved' && calibration[l.slug]!.nodes < 20_000);
    expect(quick.length).toBeGreaterThan(20);
    for (const l of quick) {
      const r = solve(l.code, { maxNodes: 40_000 });
      expect(r.status, l.slug).toBe('solved');
      if (r.status === 'solved') expect(simulate(decodeBoard(`${l.code}_${r.solution}`)).outcome, l.slug).toBe('won');
    }
  }, 120_000);

  test('reports how often the best player used fewer segments than the solver', () => {
    // Best-first search isn't guaranteed shortest, so this records how often players do better.
    const worse = levels.filter((l) => {
      const c = calibration[l.slug];
      const best = Math.min(...(players[l.slug] ?? []).map((p) => Math.floor(p.trackCount / 1000) + (p.trackCount % 1000)));
      return c?.status === 'solved' && c.segments! > best;
    });
    console.log(`players beat the solver's segment count on ${worse.length} of ${levels.length} originals`);
    expect(worse.length).toBeLessThan(levels.length);
  });
});
