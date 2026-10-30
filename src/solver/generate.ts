import { encodeBoard, splitCode } from '../engine/codec.ts';
import { createRun, segmentFor } from '../engine/sim.ts';
import type { Board, Color, Piece, Segment, Side } from '../engine/types.ts';
import { BANDS, grade, type Difficulty } from './difficulty.ts';
import { solve } from './solve.ts';
import { between, mulberry32, pick } from './random.ts';

/**
 * Builds puzzles backwards from a solution: lay outlets and routes of real track (with
 * painters, splitters, merges and switches by difficulty), run the trains with goals that
 * accept anything, then make each goal want exactly what reached it. The track is the proof.
 */

interface Recipe {
  outlets: [number, number];
  trains: [number, number];
  colors: Color[];
  route: [number, number];
  painter: number;
  splitter: number;
  merge: number;
  fork: number;
  rocks: [number, number];
}

const RECIPES: Record<Difficulty, Recipe> = {
  easy: { outlets: [1, 2], trains: [1, 2], colors: [0, 1, 2], route: [3, 7], painter: 0, splitter: 0, merge: 0, fork: 0, rocks: [0, 2] },
  medium: { outlets: [1, 3], trains: [1, 3], colors: [0, 1, 2], route: [3, 8], painter: 0.25, splitter: 0, merge: 0.4, fork: 0, rocks: [1, 3] },
  hard: { outlets: [2, 3], trains: [1, 3], colors: [0, 1, 2, 3, 4, 5], route: [3, 9], painter: 0.25, splitter: 0.3, merge: 0.4, fork: 0.5, rocks: [2, 5] },
  veryHard: { outlets: [3, 4], trains: [2, 4], colors: [0, 1, 2, 3, 4, 5], route: [4, 10], painter: 0.3, splitter: 0.35, merge: 0.5, fork: 0.6, rocks: [3, 6] },
};

const COLS = 7;
const ROWS = 7;
const SIDES: Side[] = [0, 1, 2, 3];
const opposite = (s: Side): Side => ((s + 2) % 4) as Side;

function neighbor(cell: number, side: Side): number | null {
  const col = (cell % COLS) + [0, 1, 0, -1][side]!;
  const row = Math.floor(cell / COLS) + [-1, 0, 1, 0][side]!;
  return col < 0 || col >= COLS || row < 0 || row >= ROWS ? null : row * COLS + col;
}

class Builder {
  cells: Piece[] = Array.from({ length: COLS * ROWS }, (): Piece => ({ kind: 'empty' }));
  constructor(readonly rnd: () => number, readonly recipe: Recipe) {}

  free(cell: number | null): cell is number {
    return cell !== null && this.cells[cell]!.kind === 'empty';
  }

  /**
   * Lays a route that enters `cell` through `entry`: random turns through free cells, maybe a
   * painter, a merge into existing track, or a splitter. Ends by placing a goal. Returns false
   * if it boxed itself in.
   */
  route(cell: number, entry: Side, length: number): boolean {
    const r = this.recipe;
    for (let step = 0; ; step++) {
      if (step >= length) {
        this.cells[cell] = { kind: 'goal', sides: [entry], colors: [] };
        return true;
      }
      // merge: if a neighbor is a single straight-through track we can join, add a second segment there
      if (r.merge && this.rnd() < r.merge / length && step > 0) {
        for (const exit of SIDES) {
          if (exit === entry) continue;
          const n = neighbor(cell, exit);
          const target = n === null ? null : this.cells[n]!;
          if (n === null || target?.kind !== 'track' || target.secondary !== 0) continue;
          const into = opposite(exit);
          const sides = segSides(target.primary);
          if (sides.includes(into)) continue;
          const out = sides.find((s) => s !== into)!; // join, leaving the way the existing track leaves
          this.cells[cell] = { kind: 'track', primary: segmentFor(entry, exit), secondary: 0 };
          this.cells[n] = { kind: 'track', primary: target.primary, secondary: segmentFor(into, out) };
          return true;
        }
      }
      const exits = SIDES.filter((s) => s !== entry && this.free(neighbor(cell, s)));
      if (!exits.length) return false;
      const straight = opposite(entry);
      const exit = exits.includes(straight) && this.rnd() < 0.5 ? straight : pick(this.rnd, exits);
      if (r.splitter && step > 0 && this.rnd() < r.splitter / length) {
        const outs = [((entry + 1) % 4) as Side, ((entry + 3) % 4) as Side];
        if (outs.every((s) => this.free(neighbor(cell, s)))) {
          this.cells[cell] = { kind: 'splitter', in: entry };
          const rest = Math.max(2, length - step);
          return outs.every((s) => this.route(neighbor(cell, s)!, opposite(s), between(this.rnd, 2, rest)));
        }
      }
      if (r.painter && exit === straight && this.rnd() < r.painter / 2) {
        this.cells[cell] = { kind: 'painter', color: pick(this.rnd, r.colors), a: entry, b: exit };
      } else {
        this.cells[cell] = { kind: 'track', primary: segmentFor(entry, exit), secondary: 0 };
      }
      cell = neighbor(cell, exit)!;
      entry = opposite(exit);
    }
  }

  /** Turns a single track cell on an outlet's route into a fork, and lays the other branch. */
  fork(): void {
    const singles = this.cells.flatMap((p, i) => (p.kind === 'track' && p.secondary === 0 ? [i] : []));
    if (!singles.length) return;
    const cell = pick(this.rnd, singles);
    const p = this.cells[cell] as Extract<Piece, { kind: 'track' }>;
    const [a, b] = segSides(p.primary);
    // a fork shares the side trains enter by; try either end of the existing segment as that side
    for (const entry of [a, b]) {
      const alts = SIDES.filter((s) => s !== a && s !== b && this.free(neighbor(cell, s)));
      if (!alts.length) continue;
      const alt = pick(this.rnd, alts);
      this.cells[cell] = { kind: 'track', primary: p.primary, secondary: segmentFor(entry, alt) };
      this.route(neighbor(cell, alt)!, opposite(alt), between(this.rnd, ...this.recipe.route));
      return;
    }
  }
}

const SEG_SIDES: Record<number, [Side, Side]> = { 1: [0, 1], 2: [0, 3], 3: [2, 3], 4: [2, 1], 5: [0, 2], 6: [3, 1] };
const segSides = (s: Segment): [Side, Side] => SEG_SIDES[s]!;

const withoutTrack = (cells: Piece[]): Piece[] => cells.map((p) => (p.kind === 'track' ? { kind: 'empty' } : p));

/** One construction attempt. Returns null if the seed leads nowhere useful. */
export function generateCandidate(seed: number, difficulty: Difficulty): { code: string; proof: string } | null {
  const rnd = mulberry32(seed * 2654435761 + difficulty.length);
  const recipe = RECIPES[difficulty];
  const b = new Builder(rnd, recipe);

  const outlets = between(rnd, ...recipe.outlets);
  for (let i = 0; i < outlets; i++) {
    const free = b.cells.flatMap((p, c) => (p.kind === 'empty' ? [c] : []));
    const cell = pick(rnd, free);
    const sides = SIDES.filter((s) => b.free(neighbor(cell, s)));
    if (!sides.length) continue;
    const side = pick(rnd, sides);
    const colors = Array.from({ length: between(rnd, ...recipe.trains) }, () => pick(rnd, recipe.colors));
    b.cells[cell] = { kind: 'outlet', side, colors };
    if (!b.route(neighbor(cell, side)!, opposite(side), between(rnd, ...recipe.route))) return null;
  }
  if (recipe.fork && rnd() < recipe.fork) b.fork();

  // run the trains with goals that accept anything, recording what each goal receives
  const accepting = b.cells.map((p): Piece => (p.kind === 'goal' ? { ...p, colors: Array.from({ length: 54 }, (_, k) => (k % 6) as Color) } : p));
  const run = createRun({ cols: COLS, rows: ROWS, cells: accepting });
  const received = new Map<number, Color[]>();
  while (!run.ended && run.halfSteps < 600) {
    const ev = run.halfStep();
    if (ev.crashes.length) return null;
    for (const cell of ev.delivered) {
      const t = run.trainsBefore.find((x) => x.cell === cell);
      if (t) received.set(cell, [...(received.get(cell) ?? []), t.color]);
    }
  }
  if (!run.ended || run.trains.length) return null;
  const goals = b.cells.flatMap((p, c) => (p.kind === 'goal' ? [c] : []));
  if (!goals.length || goals.some((g) => !(received.get(g)?.length) || received.get(g)!.length > 9)) return null;
  for (const g of goals) (b.cells[g] as Extract<Piece, { kind: 'goal' }>).colors = received.get(g)!;

  // the proof must win with the goals as set
  const solved: Board = { cols: COLS, rows: ROWS, cells: b.cells };
  const check = createRun(solved);
  while (!check.ended && check.halfSteps < 600) check.halfStep();
  if (check.outcome !== 'won') return null;

  // rocks on cells the proof never uses can't break it
  for (let k = between(rnd, ...recipe.rocks); k > 0; k--) {
    const free = b.cells.flatMap((p, c) => (p.kind === 'empty' ? [c] : []));
    if (free.length) b.cells[pick(rnd, free)] = { kind: 'rock' };
  }

  const proof = splitCode(encodeBoard({ cols: COLS, rows: ROWS, cells: b.cells }, { puzzle: false })).solution;
  const code = encodeBoard({ cols: COLS, rows: ROWS, cells: withoutTrack(b.cells) }, { solution: false });
  return { code, proof };
}

export interface Generated {
  code: string;
  proof: string;
  difficulty: Difficulty;
  seed: number;
  segments: number | null;
  nodes: number | null;
  /** True when time ran out and this is the closest candidate found, below the level asked for. */
  easierThanAsked: boolean;
}

const RANK: Record<Difficulty | 'tooEasy', number> = { tooEasy: 0, easy: 1, medium: 2, hard: 3, veryHard: 4 };

/** Generates candidates until one grades at the level asked for, or the deadline passes. */
export function generate(difficulty: Difficulty, opts: { seed?: number; deadline: number; onProgress?: (tried: number) => void }): Generated {
  const start = opts.seed ?? Math.floor(Math.random() * 1_000_000);
  const band = BANDS[difficulty];
  let best: (Generated & { rank: number }) | null = null;
  let fallback: Generated | null = null; // any graded candidate, used if nothing at or below the level turns up
  for (let i = 0; ; i++) {
    const seed = start + i;
    opts.onProgress?.(i + 1);
    const c = generateCandidate(seed, difficulty);
    if (c && performance.now() > opts.deadline && !best && !fallback) {
      // out of time with nothing graded: take this one ungraded (it is solvable by construction)
      return { ...c, difficulty, seed, segments: null, nodes: null, easierThanAsked: true };
    }
    if (c) {
      const r = solve(c.code, { maxNodes: band.maxNodes, deadline: opts.deadline });
      const deadlineHit = r.status === 'unknown' && r.reason === 'deadline';
      if (!deadlineHit) {
        const g = grade(r);
        const fits = g === difficulty && (r.status === 'solved' || band.acceptUnknown);
        const found: Generated = { ...c, difficulty, seed, segments: r.status === 'solved' ? r.segments : null, nodes: r.nodes, easierThanAsked: false };
        if (fits) return found;
        fallback ??= found;
        // keep the closest candidate that isn't above the level asked for
        const rank = RANK[g];
        if (rank <= RANK[difficulty] && (!best || rank > best.rank)) best = { ...found, rank };
      }
    }
    if (performance.now() > opts.deadline) {
      if (best) {
        const { rank: _rank, ...g } = best;
        return { ...g, easierThanAsked: true };
      }
      if (fallback) return fallback;
    }
  }
}
