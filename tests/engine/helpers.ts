import type { Board, Color, Piece, Segment, Side } from '../../src/engine/types.ts';

/** Builds a 7×7 board from pieces keyed by "col,row"; every other cell is empty. */
export function board(spec: Record<string, Piece>, cols = 7, rows = 7): Board {
  const cells: Piece[] = Array.from({ length: cols * rows }, () => ({ kind: 'empty' }));
  for (const [key, piece] of Object.entries(spec)) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    cells[r * cols + c] = piece;
  }
  return { cols, rows, cells };
}

export const at = (col: number, row: number, cols = 7) => row * cols + col;
export const track = (primary: Segment, secondary: Segment = 0): Piece => ({ kind: 'track', primary, secondary });
export const outlet = (side: Side, ...colors: Color[]): Piece => ({ kind: 'outlet', side, colors });
export const goal = (sides: Side[], ...colors: Color[]): Piece => ({ kind: 'goal', sides, colors });
export const painter = (color: Color, a: Side, b: Side): Piece => ({ kind: 'painter', color, a, b });
export const splitter = (side: Side): Piece => ({ kind: 'splitter', in: side });
export const rock: Piece = { kind: 'rock' };
/** An unreachable goal that keeps a run from ending before the test looks at it. */
export const dummyGoal = { '6,6': goal([0], 0) };
