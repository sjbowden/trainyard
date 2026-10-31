import { decodeBoard, encodeBoard, splitCode } from '../engine/codec.ts';
import { createRun, segmentFor, simulate, type TrainState } from '../engine/sim.ts';
import type { Board, Piece, Segment, Side } from '../engine/types.ts';

/**
 * Finds track that solves a puzzle by playing it: simulate, and wherever a train is about to
 * crash for want of track, branch on what to lay there. The search is best-first (segments so
 * far plus the waiting train's distance to a goal), so solutions are short but not proven
 * shortest. Switches are tried where a train reaches the wrong goal. See the Stage 4 plan.
 */

export interface SolveOptions {
  maxNodes?: number;
  maxSegments?: number;
  /** A performance.now() time to stop by. */
  deadline?: number;
}

export type SolveResult =
  /** `optimal` is true when the search proved no solution uses fewer segments. */
  | { status: 'solved'; solution: string; segments: number; nodes: number; optimal: boolean }
  | { status: 'unknown'; nodes: number; reason: 'budget' | 'deadline' | 'exhausted' };

/** Track laid so far: cell → [primary, secondary]. */
type Layout = Map<number, [Segment, Segment]>;

const MAX_HALF_STEPS = 800;
const opposite = (s: Side): Side => ((s + 2) % 4) as Side;

class Stop extends Error {
  constructor(readonly reason: 'budget' | 'deadline') {
    super(reason);
  }
}

function neighbor(b: Board, cell: number, side: Side): number | null {
  const col = (cell % b.cols) + [0, 1, 0, -1][side]!;
  const row = Math.floor(cell / b.cols) + [-1, 0, 1, 0][side]!;
  return col < 0 || col >= b.cols || row < 0 || row >= b.rows ? null : row * b.cols + col;
}

function withTrack(puzzle: Board, layout: Layout): Board {
  const cells = puzzle.cells.slice();
  for (const [cell, [primary, secondary]] of layout) cells[cell] = { kind: 'track', primary, secondary };
  return { ...puzzle, cells };
}

const countSegments = (layout: Layout) => [...layout.values()].reduce((n, [p, s]) => n + (p ? 1 : 0) + (s ? 1 : 0), 0);

type Outcome =
  | { kind: 'won' }
  | { kind: 'dead' }
  /** A train is about to enter `cell` through `entry` and finds no track for that side. */
  | { kind: 'needsTrack'; cell: number; entry: Side }
  /** A train reached a goal that didn't want it, after passing these cells (cell, entry, exit). */
  | { kind: 'wrongGoal'; path: [number, Side, Side][] };

/** Plays the layout until it wins, fails for good, or needs track somewhere. */
function play(puzzle: Board, layout: Layout): Outcome {
  const board = withTrack(puzzle, layout);
  const run = createRun(board);
  const paths = new Map<number, [number, Side, Side][]>();
  while (!run.ended && run.halfSteps < MAX_HALF_STEPS) {
    const ev = run.halfStep();
    if (run.outcome === 'won') return { kind: 'won' };
    // full goals with trains still about can't win: no goal will take a leftover train
    if (run.board.cells.every((c) => c.kind !== 'goal' || c.colors.length === 0)) return { kind: 'dead' };
    if (ev.phase === 'B') {
      for (const t of run.trains) {
        const path = paths.get(t.id) ?? [];
        path.push([t.cell, t.entry, t.nextSide]);
        paths.set(t.id, path);
      }
    }
    if (!ev.crashes.length) continue;
    if (ev.phase === 'A') {
      // a wrong color at a goal: a switch somewhere on that train's path might send it elsewhere
      const t = run.trainsBefore.find((x) => ev.crashes.includes(x.cell) && board.cells[x.cell]!.kind === 'goal');
      return t ? { kind: 'wrongGoal', path: paths.get(t.id) ?? [] } : { kind: 'dead' };
    }
    // An edge crash is fixable only if the train ran into an empty cell, or a track cell with room for a second segment.
    let fix: Outcome | null = null;
    for (const t of run.trainsBefore as TrainState[]) {
      const next = neighbor(board, t.cell, t.nextSide);
      if (next === null || !ev.crashes.includes(next) || run.trains.some((x) => x.id === t.id)) {
        if (next === null && ev.crashes.includes(t.cell) && !run.trains.some((x) => x.id === t.id)) return { kind: 'dead' }; // off the board
        continue;
      }
      const piece = board.cells[next]!;
      const room = piece.kind === 'empty' || (piece.kind === 'track' && piece.secondary === 0);
      if (!room) return { kind: 'dead' };
      fix ??= { kind: 'needsTrack', cell: next, entry: opposite(t.nextSide) };
    }
    return fix ?? { kind: 'dead' };
  }
  return { kind: 'dead' };
}

/** Manhattan distance to the nearest goal, used to try promising exits first. */
function goalDistance(b: Board, goals: number[], cell: number | null): number {
  if (cell === null) return Infinity;
  return Math.min(...goals.map((g) => Math.abs((g % b.cols) - (cell % b.cols)) + Math.abs(Math.floor(g / b.cols) - Math.floor(cell / b.cols))));
}

/** The ways to lay track for a train entering `cell` through `entry`. */
function choices(b: Board, layout: Layout, goals: number[], cell: number, entry: Side): [number, [Segment, Segment]][] {
  // exits off the board can't work; the rest go nearest-to-a-goal first
  const exits = ([0, 1, 2, 3] as Side[])
    .filter((s) => s !== entry && neighbor(b, cell, s) !== null)
    .sort((x, y) => goalDistance(b, goals, neighbor(b, cell, x)) - goalDistance(b, goals, neighbor(b, cell, y)));
  const segs = exits.map((x) => segmentFor(entry, x));
  const existing = layout.get(cell);
  // a second segment goes in as the passive one or on top
  if (existing) return segs.flatMap((s): [number, [Segment, Segment]][] => [[cell, [existing[0], s]], [cell, [s, existing[0]]]]);
  return segs.map((s): [number, [Segment, Segment]] => [cell, [s, 0]]);
}

/** After a wrong goal: turn a single segment on that train's path into a fork switch. */
function forks(layout: Layout, path: [number, Side, Side][]): [number, [Segment, Segment]][] {
  const out: [number, [Segment, Segment]][] = [];
  const seen = new Set<number>();
  for (const [cell, entry, exit] of [...path].reverse()) {
    const laid = layout.get(cell);
    if (!laid || laid[1] !== 0 || seen.has(cell)) continue;
    seen.add(cell);
    for (const alt of [0, 1, 2, 3] as Side[]) {
      if (alt === entry || alt === exit) continue;
      const other = segmentFor(entry, alt);
      out.push([cell, [laid[0], other]], [cell, [other, laid[0]]]);
    }
  }
  return out;
}

/**
 * A quick necessary condition: every goal must have an entry side that track can reach from some
 * outlet, through empty cells and pass-through pieces. If not, no layout can solve the puzzle.
 */
function goalsReachable(b: Board): boolean {
  const passable = (p: Piece) => p.kind === 'empty' || p.kind === 'painter' || p.kind === 'splitter';
  const reached = new Set<number>();
  const queue: number[] = [];
  b.cells.forEach((p, cell) => {
    if (p.kind !== 'outlet') return;
    const first = neighbor(b, cell, p.side);
    if (first !== null) queue.push(first);
  });
  while (queue.length) {
    const cell = queue.pop()!;
    if (reached.has(cell)) continue;
    reached.add(cell);
    if (!passable(b.cells[cell]!)) continue;
    for (const side of [0, 1, 2, 3] as Side[]) {
      const n = neighbor(b, cell, side);
      if (n !== null && !reached.has(n)) queue.push(n);
    }
  }
  return b.cells.every((p, cell) => p.kind !== 'goal' || p.sides.some((side) => {
    const n = neighbor(b, cell, side);
    return n !== null && reached.has(n) && passable(b.cells[n]!);
  }) || isFedDirectly(b, cell));
}

/** True if an outlet's exit points straight into this goal. */
function isFedDirectly(b: Board, goal: number): boolean {
  return b.cells.some((p, cell) => p.kind === 'outlet' && neighbor(b, cell, p.side) === goal);
}

export function solve(puzzleCode: string, opts: SolveOptions = {}): SolveResult {
  const { maxNodes = 200_000, maxSegments = 40, deadline = Infinity } = opts;
  const puzzle = decodeBoard(splitCode(puzzleCode).puzzle);
  const goals = puzzle.cells.flatMap((p: Piece, i) => (p.kind === 'goal' ? [i] : []));
  let nodes = 0;
  const key = (layout: Layout) => [...layout].sort((x, y) => x[0] - y[0]).map(([c, [p, q]]) => `${c}:${p}${q}`).join(',');

  // Best-first search: always extend the layout with the fewest segments plus the waiting
  // train's distance to the nearest goal. Each layout is played once, when it is created.
  interface Node { layout: Layout; used: number; outcome: Outcome; f: number }
  const heap: Node[] = [];
  const push = (n: Node) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.f <= heap[i]!.f) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): Node | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]!.f < heap[m]!.f) m = l;
        if (r < heap.length && heap[r]!.f < heap[m]!.f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const seen = new Set<string>();
  const visit = (layout: Layout) => {
    const k = key(layout);
    if (seen.has(k)) return;
    seen.add(k);
    if (++nodes > maxNodes) throw new Stop('budget');
    if ((nodes & 63) === 0 && performance.now() > deadline) throw new Stop('deadline');
    const outcome = play(puzzle, layout);
    if (outcome.kind === 'dead') return;
    const used = countSegments(layout);
    const h = outcome.kind === 'needsTrack' ? Math.max(1, goalDistance(puzzle, goals, outcome.cell)) : outcome.kind === 'wrongGoal' ? 1 : 0;
    push({ layout, used, outcome, f: used + h });
  };

  let best: Layout | null = null;
  let stopped: 'budget' | 'deadline' | null = null;
  try {
    if (performance.now() > deadline) throw new Stop('deadline');
    if (goalsReachable(puzzle)) {
      visit(new Map());
      for (let node = pop(); node; node = pop()) {
        if (node.outcome.kind === 'won') {
          best = node.layout;
          break;
        }
        const o = node.outcome;
        const options = o.kind === 'needsTrack' ? choices(puzzle, node.layout, goals, o.cell, o.entry) : o.kind === 'wrongGoal' ? forks(node.layout, o.path) : [];
        for (const [cell, seg] of options) {
          const next = new Map(node.layout);
          next.set(cell, seg);
          if (countSegments(next) > maxSegments) continue;
          visit(next);
        }
      }
    }
  } catch (err) {
    if (!(err instanceof Stop)) throw err;
    stopped = err.reason;
  }
  if (!best) return { status: 'unknown', nodes, reason: stopped ?? 'exhausted' };
  const solved = withTrack(puzzle, best);
  if (simulate(solved).outcome !== 'won') throw new Error('solver produced a non-winning layout'); // never expected
  const solution = splitCode(encodeBoard(solved, { puzzle: false })).solution;
  // the distance estimate can overestimate (reused track), so the first solution is short but not proven shortest
  return { status: 'solved', solution, segments: countSegments(best), nodes, optimal: false };
}

