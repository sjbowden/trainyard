import type { Board, Color } from '../../engine/types.ts';
import type { EffectKind, Theme } from '../theme/theme.ts';
import type { Layout } from './geometry.ts';
import { cellCenter } from './geometry.ts';

export interface DrawnTrain { color: Color; x: number; y: number; angle: number }
export interface DrawnEffect { kind: EffectKind; cell: number; t: number }

/** Draws one frame: floor, pieces, trains, then effects on top. */
export function renderBoard(ctx: CanvasRenderingContext2D, theme: Theme, l: Layout, board: Board, trains: DrawnTrain[], effects: DrawnEffect[] = []): void {
  theme.drawFloor(ctx, l);
  board.cells.forEach((piece, i) => {
    theme.drawPiece(ctx, piece, l.originX + (i % l.cols) * l.cell, l.originY + Math.floor(i / l.cols) * l.cell, l.cell);
  });
  for (const t of trains) theme.drawTrain(ctx, t.color, t.x, t.y, t.angle, l.cell);
  for (const e of effects) {
    const c = cellCenter(l, e.cell);
    theme.drawEffect(ctx, e.kind, c.x, c.y, l.cell, e.t);
  }
}
