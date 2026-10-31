import { segmentSides } from './codec.ts';
import type { Board, Color, Piece, Segment, Side } from './types.ts';

/** Runs a board with the original game's rules (see docs/rules.md). */

export interface TrainState {
  id: number;
  color: Color;
  cell: number;
  /** The side it entered its current cell by (for a new train, the side opposite its exit). */
  entry: Side;
  nextSide: Side;
  segment: Segment | null;
  alive: boolean;
}

export type Outcome = 'running' | 'won' | 'crashed' | 'stalled';

export interface HalfStepEvents {
  phase: 'A' | 'B';
  crashes: number[];
  painted: number[];
  splits: number[];
  delivered: number[];
  switched: number[];
  merged: number[];
}

export interface Run {
  /** Live state: switches flip and outlets and goals empty as the run goes. Not for encoding or saving. */
  readonly board: Board;
  readonly trains: readonly TrainState[];
  readonly outcome: Outcome;
  readonly halfSteps: number;
  readonly steps: number;
  /** True once the run is over. A crashed run keeps moving until then, as in the original. */
  readonly ended: boolean;
  /** The trains as they were at the start of the last half-step, including any that then died. */
  readonly trainsBefore: readonly TrainState[];
  halfStep(): HalfStepEvents;
}

const opposite = (s: Side): Side => ((s + 2) % 4) as Side;

const SECONDARY_PRIMARIES: Partial<Record<Color, [Color, Color]>> = { 3: [1, 0], 4: [2, 1], 5: [2, 0] };

export function mix(a: Color, b: Color): Color {
  if (a === b) return a;
  for (const [secondary, [p, q]] of Object.entries(SECONDARY_PRIMARIES)) {
    if ((p === a && q === b) || (p === b && q === a)) return Number(secondary) as Color;
  }
  return 6;
}

/** True when every goal has received everything it needs. */
export function goalsFilled(board: Board): boolean {
  return board.cells.every((c) => c.kind !== 'goal' || c.colors.length === 0);
}

/** The segment joining two sides, or Empty. */
export function segmentFor(a: Side, b: Side): Segment {
  for (let s = 1; s <= 6; s++) {
    const sides = segmentSides(s as Segment)!;
    if ((sides[0] === a && sides[1] === b) || (sides[0] === b && sides[1] === a)) return s as Segment;
  }
  return 0;
}

function hasSide(s: Segment, side: Side): boolean {
  const sides = segmentSides(s);
  return sides !== null && (sides[0] === side || sides[1] === side);
}

function otherSide(s: Segment, side: Side): Side {
  const [a, b] = segmentSides(s)!;
  return a === side ? b : a;
}

/** A switch is a track cell whose two segments share a side. */
export function isSwitchable(piece: Piece): boolean {
  if (piece.kind !== 'track' || piece.primary === 0 || piece.secondary === 0) return false;
  const [a, b] = segmentSides(piece.primary)!;
  return hasSide(piece.secondary, a) || hasSide(piece.secondary, b);
}

function isCross(a: Segment | null, b: Segment | null): boolean {
  return (a === 6 && b === 5) || (a === 5 && b === 6);
}

/** Copies the parts a run changes (switches, outlet and goal lists); everything else is immutable during a run. */
function copyPiece(c: Piece): Piece {
  switch (c.kind) {
    case 'track':
      return { kind: 'track', primary: c.primary, secondary: c.secondary };
    case 'outlet':
      return { kind: 'outlet', side: c.side, colors: c.colors.slice() };
    case 'goal':
      return { kind: 'goal', sides: c.sides.slice(), colors: c.colors.slice() };
    default:
      return c;
  }
}

function cloneBoard(board: Board): Board {
  return { cols: board.cols, rows: board.rows, cells: board.cells.map(copyPiece) };
}

class RunImpl implements Run {
  readonly board: Board;
  trains: TrainState[] = [];
  outcome: Outcome = 'running';
  halfSteps = 0;
  steps = 0;
  private crashed = false;
  get ended(): boolean {
    return this.over;
  }
  /** Set when the run has ended; a crashed run keeps stepping until then, as in the original. */
  private over = false;
  trainsBefore: TrainState[] = [];
  private nextId = 0;
  private queued = new Map<number, TrainState[]>();

  constructor(board: Board) {
    this.board = cloneBoard(board);
  }

  private neighbor(cell: number, side: Side): number | null {
    const { cols, rows } = this.board;
    const col = (cell % cols) + [0, 1, 0, -1][side]!;
    const row = Math.floor(cell / cols) + [-1, 0, 1, 0][side]!;
    return col < 0 || col >= cols || row < 0 || row >= rows ? null : row * cols + col;
  }

  private crash(train: TrainState, ev: HalfStepEvents) {
    train.alive = false;
    this.crashed = true;
    ev.crashes.push(train.cell);
  }

  private newTrain(color: Color, cell: number, side: Side): TrainState {
    return { id: this.nextId++, color, cell, entry: opposite(side), nextSide: side, segment: null, alive: true };
  }

  private prune() {
    this.trains = this.trains.filter((t) => t.alive);
  }

  halfStep(): HalfStepEvents {
    const phase = this.halfSteps % 2 === 0 ? 'A' : 'B';
    const ev: HalfStepEvents = { phase, crashes: [], painted: [], splits: [], delivered: [], switched: [], merged: [] };
    if (this.over) return ev;
    this.trainsBefore = this.trains.map((t) => ({ ...t }));
    if (phase === 'A') this.centerHalf(ev);
    else this.edgeHalf(ev);
    this.halfSteps++;
    if (phase === 'B') this.steps++;
    this.settle();
    return ev;
  }

  /** Updates the outcome after a half-step. */
  private settle() {
    if (this.over) return;
    if (this.crashed) this.outcome = 'crashed';
    const pending = this.board.cells.some((c) => c.kind === 'outlet' && c.colors.length > 0) || this.queued.size > 0;
    if (!this.trains.some((t) => t.alive) && !pending) {
      this.over = true;
      if (!this.crashed) this.outcome = 'stalled';
    }
  }

  private centerHalf(ev: HalfStepEvents) {
    for (const t of this.trains) {
      if (!t.alive) continue;
      const piece = this.board.cells[t.cell]!;
      if (piece.kind === 'painter') {
        t.color = piece.color;
        ev.painted.push(t.cell);
      } else if (piece.kind === 'splitter') {
        const [first, second] = SECONDARY_PRIMARIES[t.color] ?? [t.color, t.color];
        const out: Side[] = [((piece.in + 1) % 4) as Side, ((piece.in + 3) % 4) as Side];
        const queue = this.queued.get(t.cell) ?? [];
        queue.push(this.newTrain(first, t.cell, out[0]!), this.newTrain(second, t.cell, out[1]!));
        this.queued.set(t.cell, queue);
        t.alive = false;
        ev.splits.push(t.cell);
      } else if (piece.kind === 'goal') {
        const i = piece.colors.indexOf(t.color);
        if (i >= 0) {
          piece.colors.splice(i, 1);
          t.alive = false;
          ev.delivered.push(t.cell);
        } else {
          this.crash(t, ev);
        }
      }
    }
    this.prune();

    for (let i = 0; i < this.trains.length; i++) {
      for (let j = i + 1; j < this.trains.length; j++) {
        const a = this.trains[i]!;
        const b = this.trains[j]!;
        if (a.alive && b.alive && a.cell === b.cell && (a.segment === b.segment || isCross(a.segment, b.segment))) {
          a.color = b.color = mix(a.color, b.color);
        }
      }
    }
    this.prune();

    this.board.cells.forEach((piece, cell) => {
      if (piece.kind === 'outlet' && piece.colors.length > 0) {
        this.trains.push(this.newTrain(piece.colors.shift()!, cell, piece.side));
      }
      const queue = this.queued.get(cell);
      if (queue) {
        this.trains.push(...queue);
        this.queued.delete(cell);
      }
    });

    // as in the original, full goals solve the puzzle only once no trains remain. Every outlet with
    // trains and every splitter queue has just released into this.trains, so none are waiting either.
    if (!this.over && this.trains.length === 0 && goalsFilled(this.board)) {
      this.over = true;
      this.outcome = this.crashed ? 'crashed' : 'won';
    }
  }

  private edgeHalf(ev: HalfStepEvents) {
    for (let i = 0; i < this.trains.length; i++) {
      const a = this.trains[i]!;
      for (let j = i + 1; j < this.trains.length; j++) {
        const b = this.trains[j]!;
        if (!a.alive || !b.alive) continue;
        if (a.cell === b.cell && a.nextSide === b.nextSide) {
          a.color = mix(a.color, b.color);
          b.alive = false;
          ev.merged.push(a.cell);
        }
        if (
          a.alive && b.alive &&
          this.neighbor(a.cell, a.nextSide) === b.cell &&
          this.neighbor(b.cell, b.nextSide) === a.cell &&
          opposite(a.nextSide) === b.nextSide
        ) {
          a.color = b.color = mix(a.color, b.color);
        }
      }
      // The original toggles once per train on the tile, merged trains included.
      const piece = this.board.cells[a.cell]!;
      if (piece.kind === 'track' && this.toggle(piece)) ev.switched.push(a.cell);
    }
    this.prune();

    for (const t of this.trains) {
      const next = this.neighbor(t.cell, t.nextSide);
      if (next === null) {
        this.crash(t, ev);
        continue;
      }
      t.cell = next;
      t.entry = opposite(t.nextSide);
      if (!this.enter(t, this.board.cells[next]!, t.entry)) this.crash(t, ev);
    }
    this.prune();
  }

  /** Flips a switch whose two segments share a side. Returns true if it flipped. */
  private toggle(piece: Extract<Piece, { kind: 'track' }>): boolean {
    if (!isSwitchable(piece)) return false;
    const { primary, secondary } = piece;
    piece.primary = secondary;
    piece.secondary = primary;
    return true;
  }

  /** Moves a train into a piece through its entry side. Returns false if the train crashes. */
  private enter(t: TrainState, piece: Piece, entry: Side): boolean {
    switch (piece.kind) {
      case 'track': {
        const seg = hasSide(piece.primary, entry) ? piece.primary : hasSide(piece.secondary, entry) ? piece.secondary : null;
        if (seg === null) return false;
        t.segment = seg;
        t.nextSide = otherSide(seg, entry);
        return true;
      }
      case 'painter': {
        if (entry !== piece.a && entry !== piece.b) return false;
        t.nextSide = entry === piece.a ? piece.b : piece.a;
        t.segment = segmentFor(entry, t.nextSide);
        return true;
      }
      case 'goal':
        if (!piece.sides.includes(entry)) return false;
        t.nextSide = opposite(entry);
        t.segment = segmentFor(entry, t.nextSide);
        return true;
      case 'splitter':
        if (entry !== piece.in) return false;
        t.nextSide = opposite(entry);
        t.segment = null;
        return true;
      default:
        return false;
    }
  }
}

export function createRun(board: Board): Run {
  return new RunImpl(board);
}

export function simulate(
  board: Board,
  maxHalfSteps = 2000,
): { outcome: Exclude<Outcome, 'running'> | 'timeout'; steps: number; halfSteps: number } {
  const run = createRun(board);
  while (run.outcome === 'running' && run.halfSteps < maxHalfSteps) run.halfStep();
  const outcome = run.outcome === 'running' ? 'timeout' : run.outcome;
  return { outcome, steps: run.steps, halfSteps: run.halfSteps };
}

/** Major is the number of track cells; minor the number that also hold a secondary segment. */
export function trackCount(board: Board): { major: number; minor: number } {
  let major = 0;
  let minor = 0;
  for (const c of board.cells) {
    if (c.kind !== 'track') continue;
    major++;
    if (c.secondary !== 0) minor++;
  }
  return { major, minor };
}
