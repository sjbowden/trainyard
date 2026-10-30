// Dev only: runs the solver on every original puzzle and writes fixtures/solver-calibration.json
// (slug → stars, status, segments, nodes, ms). No puzzle codes are written.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Collection } from '../src/data/apk.ts';
import { solve } from '../src/solver/solve.ts';

export interface Calibration { stars: number; status: 'solved' | 'unknown'; segments: number | null; nodes: number; ms: number }

const OUT = 'fixtures/solver-calibration.json';
const MAX_NODES = Number(process.env.MAX_NODES ?? 1_000_000);
const collections: Collection[] = JSON.parse(readFileSync('local/collections.json', 'utf8'));
const out: Record<string, Calibration> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const levels = collections.flatMap((c) => c.levels);

for (const [i, level] of levels.entries()) {
  if (out[level.slug]) continue;
  const t = performance.now();
  const r = solve(level.code, { maxNodes: MAX_NODES });
  out[level.slug] = { stars: level.stars, status: r.status, segments: r.status === 'solved' ? r.segments : null, nodes: r.nodes, ms: Math.round(performance.now() - t) };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`[${i + 1}/${levels.length}] ${level.slug} ${level.stars}★ ${r.status} ${out[level.slug]!.segments ?? '-'} ${r.nodes} ${out[level.slug]!.ms}ms`);
}
