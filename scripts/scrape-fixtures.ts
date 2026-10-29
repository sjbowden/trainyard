// Dev only: collects known trainyard.ca solutions for every original puzzle into
// fixtures/solutions.json. Stores solution halves only, never puzzle codes.
// Polite: one request at a time, at least DELAY_MS apart. Resumes from the existing file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Collection } from '../src/data/apk.ts';
import { splitCode } from '../src/engine/codec.ts';

export interface Fixture { solution: string; trackCount: number; stepCount: number; source: string }

const OUT = 'fixtures/solutions.json';
const DELAY_MS = 600;
const PER_FILTER = 3;
const FILTERS = ['economical', 'shortest', 'newest'];
// Some recorded solutions loop for millions of steps; they are too slow to replay in tests.
const MAX_STEPS = 500;
const HEADERS = { 'User-Agent': 'trainyard-remake-fixtures (personal, non-commercial; one request at a time)' };

let last = 0;
async function get(url: string): Promise<string> {
  const wait = last + DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`  retrying after ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  }
}

interface ListItem { id: string; encodedID: string; trackCount: string; stepCount: string }

async function listSolutions(slug: string, filter: string): Promise<ListItem[]> {
  const q = new URLSearchParams({ filterType: filter, filterData: '', resultType: 'blueprintsForLevel', extraData: slug, pageIndex: '1', itemsPerPage: String(PER_FILTER) });
  const data = JSON.parse(await get(`https://trainyard.ca/system/pages/data/getItemsAsJSON.php?${q}`));
  return data.items ?? [];
}

async function readCode(encodedID: string): Promise<string | null> {
  const html = await get(`https://trainyard.ca/${encodedID}`);
  return /ys:"([^"]+)"/.exec(html)?.[1] ?? null;
}

const collections: Collection[] = JSON.parse(readFileSync('local/collections.json', 'utf8'));
const out: Record<string, Fixture[]> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const levels = collections.flatMap((c) => c.levels);
for (const slug of Object.keys(out)) out[slug] = out[slug]!.filter((f) => f.stepCount <= MAX_STEPS);
let mismatches = 0;

for (const [n, level] of levels.entries()) {
  if (out[level.slug]) continue;
  const seen = new Set<string>();
  const fixtures: Fixture[] = [];
  for (const filter of FILTERS) {
    for (const item of await listSolutions(level.slug, filter)) {
      if (seen.has(item.id) || Number(item.stepCount) > MAX_STEPS) continue;
      seen.add(item.id);
      const code = await readCode(item.encodedID);
      if (!code) continue;
      const { puzzle, solution } = splitCode(code);
      if (puzzle !== level.code) {
        mismatches++;
        console.warn(`  ${level.slug}: solution ${item.encodedID} is for a different puzzle code, skipped`);
        continue;
      }
      fixtures.push({ solution, trackCount: Number(item.trackCount), stepCount: Number(item.stepCount), source: item.encodedID });
    }
  }
  out[level.slug] = fixtures;
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`[${n + 1}/${levels.length}] ${level.slug}: ${fixtures.length} solutions`);
}
console.log(`Done. ${Object.keys(out).length} puzzles, ${Object.values(out).flat().length} solutions, ${mismatches} mismatches skipped.`);
