import { splitCode, encodeBoard } from '../../engine/codec.ts';
import { createRun, deliveredColorsAt, type HalfStepEvents, type Run } from '../../engine/sim.ts';
import type { Board, Color } from '../../engine/types.ts';
import { clearTrack, drawPath, eraseCells, History, toggleSwitch } from '../editing.ts';
import { HALF_STEP_SECONDS } from './animation.ts';

/** Drives puzzle play in real time. Framework-free, so it is unit-tested without a DOM. */

/** A run still going after this many half-steps is stopped (it is looping). */
export const MAX_HALF_STEPS = 4000;

export type Finish = 'won' | 'crashed' | 'stalled' | 'stopped';

/** The colors of the trains delivered at these cells in the last half-step. */
export function deliveredColors(run: Run, cells: number[]): Color[] {
  return deliveredColorsAt(run.trainsBefore, cells);
}

/** Steps a run on the original's clock. */
export class Player {
  readonly run: Run;
  // Starts a full half-step in, so the first half-step happens at once, as in the original.
  private clock = HALF_STEP_SECONDS;
  /** Run states seen after each move. The rules are deterministic, so a repeat means a loop. */
  private seen = new Set<string>();
  private looping = false;

  constructor(board: Board, private onEvents: (ev: HalfStepEvents) => void, private maxHalfSteps = MAX_HALF_STEPS) {
    this.run = createRun(board);
  }

  advance(seconds: number, speed: number): void {
    this.clock += Math.max(0, seconds) * speed;
    while (this.clock >= HALF_STEP_SECONDS && !this.finished) {
      this.clock -= HALF_STEP_SECONDS;
      this.onEvents(this.run.halfStep());
      if (this.run.halfSteps % 2 === 0 && !this.run.ended) this.checkLoop();
    }
    if (this.finished) this.clock = 0;
  }

  /** Where trains are within the current full step: 0 just after a move, 0.5 at the center step. */
  get progress(): number {
    return (this.run.halfSteps % 2) * 0.5 + Math.min(this.clock, HALF_STEP_SECONDS) / (2 * HALF_STEP_SECONDS);
  }

  /** A crash ends play at once (the run is frozen on it), unlike the original, which ran on. */
  get finished(): Finish | null {
    if (this.run.outcome === 'crashed') return 'crashed';
    if (this.run.ended) return this.run.outcome === 'running' ? null : (this.run.outcome as Finish);
    if (this.looping || this.run.halfSteps >= this.maxHalfSteps) return 'stopped';
    return null;
  }

  private checkLoop(): void {
    const trains = this.run.trains.map((t) => `${t.cell},${t.entry},${t.nextSide},${t.color},${t.segment}`).join(';');
    const key = `${trains}|${JSON.stringify(this.run.board.cells)}`;
    if (this.seen.has(key)) this.looping = true;
    else this.seen.add(key);
  }
}

/** The puzzle screen's state: the drawn board with undo, and the run while one is playing. */
export class PuzzleController {
  private history: History;
  private player: Player | null = null;
  private reported = false;

  constructor(
    board: Board,
    private onFinish: (f: Finish) => void,
    private onEvents: (ev: HalfStepEvents) => void = () => {},
  ) {
    this.history = new History(board);
  }

  get board(): Board {
    return this.history.current;
  }
  get running(): boolean {
    return this.player !== null;
  }
  get playing(): Player | null {
    return this.player;
  }
  get canUndo(): boolean {
    return !this.running && this.history.canUndo;
  }
  get canRedo(): boolean {
    return !this.running && this.history.canRedo;
  }
  /** The solution half of the code: the text after `_`, or '' with no track. */
  get solution(): string {
    return splitCode(encodeBoard(this.board, { puzzle: false })).solution;
  }

  draw(cells: number[]): void {
    if (!this.running) this.history.push(drawPath(this.board, cells));
  }
  erase(cells: number[]): void {
    if (!this.running) this.history.push(eraseCells(this.board, cells));
  }
  /** Flips a switch. Returns true if the cell was a switch. */
  tap(cell: number): boolean {
    if (this.running) return false;
    const next = toggleSwitch(this.board, cell);
    if (next === this.board) return false;
    this.history.push(next);
    return true;
  }
  undo(): void {
    if (!this.running) this.history.undo();
  }
  redo(): void {
    if (!this.running) this.history.redo();
  }
  clear(): void {
    if (!this.running) this.history.push(clearTrack(this.board));
  }

  start(): void {
    if (this.running) return;
    this.reported = false;
    this.player = new Player(this.board, this.onEvents);
  }
  /** Ends the run. The drawn board is untouched, since the run plays on its own copy. */
  stop(): void {
    this.player = null;
  }

  advance(seconds: number, speed: number): void {
    if (!this.player) return;
    this.player.advance(seconds, speed);
    const f = this.player.finished;
    if (f && !this.reported) {
      this.reported = true;
      this.onFinish(f);
    }
  }
}
