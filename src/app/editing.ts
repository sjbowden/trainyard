import { isSwitchable, segmentFor } from '../engine/sim.ts';
import type { Board, Piece, Segment, Side } from '../engine/types.ts';

/** Track editing, following the original game's drawing rules. All functions are pure. */

const copy = (b: Board): Board => ({ ...b, cells: b.cells.map((c) => ({ ...c })) as Piece[] });

/** The side of `from` that faces the adjacent cell `to`, or null if they aren't adjacent. */
function sideBetween(b: Board, from: number, to: number): Side | null {
  const [fc, fr, tc, tr] = [from % b.cols, Math.floor(from / b.cols), to % b.cols, Math.floor(to / b.cols)];
  if (fr === tr && tc === fc + 1) return 1;
  if (fr === tr && tc === fc - 1) return 3;
  if (fc === tc && tr === fr + 1) return 2;
  if (fc === tc && tr === fr - 1) return 0;
  return null;
}

/** Fills in the cells a fast swipe skipped, moving horizontally first, and drops repeats. */
function walk(b: Board, cells: number[]): number[] {
  const out: number[] = [];
  for (const cell of cells) {
    const prev = out[out.length - 1];
    if (prev === undefined) {
      out.push(cell);
      continue;
    }
    let last: number = prev;
    while (last !== cell) {
      const lc = last % b.cols;
      const cc = cell % b.cols;
      const next: number = lc !== cc ? last + Math.sign(cc - lc) : last + Math.sign(Math.floor(cell / b.cols) - Math.floor(last / b.cols)) * b.cols;
      out.push(next);
      last = next;
    }
  }
  return out;
}

/** Lays segment s on a cell: a new segment goes on top; redrawing the top one removes the other. */
function lay(piece: Piece, s: Segment): Piece {
  if (piece.kind === 'empty') return { kind: 'track', primary: s, secondary: 0 };
  if (piece.kind !== 'track') return piece;
  if (piece.primary === s) return { kind: 'track', primary: s, secondary: 0 };
  return { kind: 'track', primary: s, secondary: piece.primary };
}

export function drawPath(board: Board, cells: number[]): Board {
  const b = copy(board);
  const path = walk(b, cells);
  for (let i = 1; i + 1 < path.length; i++) {
    const [prev, cur, next] = [path[i - 1]!, path[i]!, path[i + 1]!];
    if (next === prev) continue;
    const entry = sideBetween(b, cur, prev);
    const exit = sideBetween(b, cur, next);
    if (entry === null || exit === null) continue;
    b.cells[cur] = lay(b.cells[cur]!, segmentFor(entry, exit));
  }
  return b;
}

export function eraseCells(board: Board, cells: number[]): Board {
  const b = copy(board);
  for (const cell of walk(b, cells)) if (b.cells[cell]?.kind === 'track') b.cells[cell] = { kind: 'empty' };
  return b;
}

export function toggleSwitch(board: Board, cell: number): Board {
  const piece = board.cells[cell];
  if (!piece || piece.kind !== 'track' || !isSwitchable(piece)) return board;
  const b = copy(board);
  b.cells[cell] = { kind: 'track', primary: piece.secondary, secondary: piece.primary };
  return b;
}

export function clearTrack(board: Board): Board {
  return { ...board, cells: board.cells.map((c) => (c.kind === 'track' ? { kind: 'empty' } : c)) };
}

/** Undo/redo over whole boards. */
export class History {
  private past: Board[] = [];
  private future: Board[] = [];
  constructor(private now: Board) {}

  get current(): Board {
    return this.now;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(b: Board): void {
    if (b === this.now) return;
    this.past.push(this.now);
    this.future = [];
    this.now = b;
  }

  undo(): Board {
    const b = this.past.pop();
    if (b) {
      this.future.push(this.now);
      this.now = b;
    }
    return this.now;
  }

  redo(): Board {
    const b = this.future.pop();
    if (b) {
      this.past.push(this.now);
      this.now = b;
    }
    return this.now;
  }
}
