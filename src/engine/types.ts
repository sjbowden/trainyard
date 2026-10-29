/** Sides of a cell: top, right, bottom, left. */
export type Side = 0 | 1 | 2 | 3;
/** Train colors: red, yellow, blue, orange, green, purple, brown. */
export type Color = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Track segments: Empty, TopRight, TopLeft, BottomLeft, BottomRight, TopBottom, LeftRight. */
export type Segment = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const SIDE = { T: 0, R: 1, B: 2, L: 3 } as const;
export const COLOR = { red: 0, yellow: 1, blue: 2, orange: 3, green: 4, purple: 5, brown: 6 } as const;
export const SEGMENT = { Empty: 0, TR: 1, TL: 2, BL: 3, BR: 4, TB: 5, LR: 6 } as const;

export type Piece =
  | { kind: 'empty' }
  | { kind: 'rock' }
  | { kind: 'track'; primary: Segment; secondary: Segment }
  | { kind: 'outlet'; side: Side; colors: Color[] }
  | { kind: 'goal'; sides: Side[]; colors: Color[] }
  | { kind: 'painter'; color: Color; a: Side; b: Side }
  | { kind: 'splitter'; in: Side };

/** A board, cells row-major from the top-left. Goal sides are kept ascending. */
export interface Board {
  cols: number;
  rows: number;
  cells: Piece[];
}
