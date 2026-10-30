import { decodeBoard } from '../engine/codec.ts';
import { simulate } from '../engine/sim.ts';
import { MAX_HALF_STEPS } from './board/player.ts';
import type { Board, Color, Piece } from '../engine/types.ts';

/** The puzzle editor's rules. All functions are pure. */

export type Tool = 'rock' | 'outlet' | 'goal' | 'painter' | 'splitter' | 'erase';

/** The colors the original editor offered: red, yellow, blue, orange, green, purple (no brown). */
export const EDITOR_COLORS: Color[] = [0, 1, 2, 3, 4, 5];

/** The most trains an outlet or goal can hold in the editor (the code format's outlet limit). */
export const MAX_TRAINS = 9;

export function emptyBoard(): Board {
  return { cols: 7, rows: 7, cells: Array.from({ length: 49 }, (): Piece => ({ kind: 'empty' })) };
}

const DEFAULTS: Record<Exclude<Tool, 'erase'>, () => Piece> = {
  rock: () => ({ kind: 'rock' }),
  outlet: () => ({ kind: 'outlet', side: 1, colors: [0] }),
  goal: () => ({ kind: 'goal', sides: [3], colors: [0] }),
  painter: () => ({ kind: 'painter', color: 0, a: 3, b: 1 }),
  splitter: () => ({ kind: 'splitter', in: 3 }),
};

export function placePiece(b: Board, cell: number, tool: Tool): Board {
  return updatePiece(b, cell, tool === 'erase' ? { kind: 'empty' } : DEFAULTS[tool]());
}

export function updatePiece(b: Board, cell: number, piece: Piece): Board {
  return { ...b, cells: b.cells.map((c, i) => (i === cell ? piece : c)) };
}

export function problems(b: Board): string[] {
  const out: string[] = [];
  if (!b.cells.some((c) => c.kind === 'outlet')) out.push('Add at least one outlet');
  if (!b.cells.some((c) => c.kind === 'goal')) out.push('Add at least one goal');
  return out;
}

/** True if the proof (a solution half) still solves this exact puzzle. */
export function proofHolds(code: string, proof: string | null): boolean {
  if (!proof) return false;
  try {
    // the same limit as play, so a puzzle solved in Test always unlocks Share
    return simulate(decodeBoard(`${code}_${proof}`), MAX_HALF_STEPS).outcome === 'won';
  } catch {
    return false;
  }
}
