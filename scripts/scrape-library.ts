// Dev only: collects the curated library of player-made puzzles from trainyard.ca into
// local/library-raw.json (never committed). The 28 featured puzzles in their four sets, plus the
// top TOP puzzles by likes and the top TOP by solve count. A puzzle's layout comes from the puzzle
// half of one of its solutions; puzzles nobody solved can't be recovered and are skipped.
// Polite: one request at a time, at least DELAY_MS apart. Resumes from the existing file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { splitCode } from '../src/engine/codec.ts';

export interface LibraryPuzzle {
  id: string;
  encodedID: string;
  name: string;
  creator: string;
  wrenches: number | null; // null for a featured puzzle the feeds didn't list
  likes: number | null;
  solves: number;
  featured?: { set: string; order: number };
  /** The puzzle code, or null when no solution could be read. */
  code: string | null;
}

interface Raw { puzzles: Record<string, LibraryPuzzle>; listed: string[] }

const OUT = 'local/library-raw.json';
const DELAY_MS = 600;
const TOP = 2000;
const PAGE = 100;
const BASE = 'https://trainyard.ca';
const HEADERS = { 'User-Agent': 'trainyard-remake-library (personal, non-commercial; one request at a time)' };

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
      if (attempt === 4) throw err;
      console.warn(`  retrying after ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 10_000 * attempt));
    }
  }
}

async function feed(params: Record<string, string>): Promise<any[]> {
  const q = new URLSearchParams({ filterData: '', extraData: '', pageIndex: '1', itemsPerPage: String(PAGE), ...params });
  return JSON.parse(await get(`${BASE}/system/pages/data/getItemsAsJSON.php?${q}`)).items ?? [];
}

const raw: Raw = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { puzzles: {}, listed: [] };
const save = () => writeFileSync(OUT, JSON.stringify(raw, null, 1) + '\n');
const listed = new Set(raw.listed);

// 1. The featured page: four sets of puzzle links /P<encodedID>, in order.
if (!listed.has('featured')) {
  const html = await get(`${BASE}/puzzles/featured`);
  const sets = html.split(/<h1>/).slice(1);
  for (const section of sets) {
    const set = /^([^<]+?) Puzzles/.exec(section)?.[1]?.trim() ?? 'Featured';
    const links = [...section.matchAll(/href='\/(P[^']+)'/g)].map((m) => m[1]!);
    for (const [order, encodedID] of links.entries()) {
      const page = await get(`${BASE}/${encodedID}`);
      const id = /"eblueprintsForPuzzle",\s*"(\d+)"/.exec(page)?.[1];
      if (!id) { console.warn(`  featured ${encodedID}: no id, skipped`); continue; }
      const [, name = '', creator = ''] = /<title>Trainyard - (.*) by (.*?)<\/title>/.exec(page) ?? [];
      const solves = Number(/solved (\d+) times/.exec(page)?.[1] ?? 0);
      raw.puzzles[id] = { ...raw.puzzles[id], id, encodedID, name, creator, wrenches: raw.puzzles[id]?.wrenches ?? null, likes: raw.puzzles[id]?.likes ?? null, solves, featured: { set, order }, code: raw.puzzles[id]?.code ?? null };
      console.log(`featured ${set} #${order + 1}: ${name} (id ${id})`);
    }
  }
  raw.listed.push('featured');
  save();
}

// 2. The feeds: top TOP by likes and by solve count.
for (const filter of ['mostLikes', 'mostSolved']) {
  for (let page = 1; page <= TOP / PAGE; page++) {
    const key = `${filter}:${page}`;
    if (listed.has(key)) continue;
    for (const it of await feed({ filterType: filter, resultType: 'epuzzles', pageIndex: String(page) })) {
      const old = raw.puzzles[it.id];
      raw.puzzles[it.id] = {
        id: it.id, encodedID: it.encodedID, name: it.name, creator: it.creatorName,
        wrenches: Number(it.wrenches), likes: Number(it.likes), solves: Number(it.solutionCount),
        ...(old?.featured ? { featured: old.featured } : {}), code: old?.code ?? null,
      };
    }
    raw.listed.push(key);
    save();
    console.log(`${key}: ${Object.keys(raw.puzzles).length} puzzles so far`);
  }
}

// 3. Each puzzle's code, from the puzzle half of its most economical solution.
const todo = Object.values(raw.puzzles).filter((p) => p.code === null && !listed.has(`code:${p.id}`));
let n = 0;
for (const p of todo) {
  n++;
  const [sol] = await feed({ filterType: 'economical', resultType: 'eblueprintsForPuzzle', extraData: p.id, itemsPerPage: '1' });
  if (sol) {
    const ys = /ys:"([^"]+)"/.exec(await get(`${BASE}/${sol.encodedID}`))?.[1];
    if (ys) p.code = splitCode(ys).puzzle;
  }
  raw.listed.push(`code:${p.id}`); // tried, so a resume doesn't ask again
  if (n % 20 === 0 || n === todo.length) {
    save();
    console.log(`[${n}/${todo.length}] codes`);
  }
}
save();
const all = Object.values(raw.puzzles);
console.log(`Done. ${all.length} puzzles, ${all.filter((p) => p.code).length} with codes, ${all.filter((p) => p.featured).length} featured.`);
