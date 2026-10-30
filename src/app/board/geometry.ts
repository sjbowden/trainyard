/** Board layout on screen, in CSS pixels. */

export interface Layout {
  originX: number;
  originY: number;
  cell: number;
  cols: number;
  rows: number;
}

/** The largest square cells that fit the area, with the board centered. */
export function fitBoard(widthPx: number, heightPx: number, cols: number, rows: number, gutter = 16): Layout {
  const cell = Math.max(0, Math.min((widthPx - 2 * gutter) / cols, (heightPx - 2 * gutter) / rows));
  return { originX: (widthPx - cell * cols) / 2, originY: (heightPx - cell * rows) / 2, cell, cols, rows };
}

export function cellAt(l: Layout, x: number, y: number): number | null {
  const col = Math.floor((x - l.originX) / l.cell);
  const row = Math.floor((y - l.originY) / l.cell);
  return col < 0 || col >= l.cols || row < 0 || row >= l.rows ? null : row * l.cols + col;
}

export function cellCenter(l: Layout, cell: number): { x: number; y: number } {
  return { x: l.originX + ((cell % l.cols) + 0.5) * l.cell, y: l.originY + (Math.floor(cell / l.cols) + 0.5) * l.cell };
}
