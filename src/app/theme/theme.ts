import type { Color, Piece } from '../../engine/types.ts';
import type { Layout } from '../board/geometry.ts';

/** Everything the board's look and sound come from. Stage 5 adds the Original theme. */

export type EffectKind = 'crash' | 'paint' | 'split' | 'deliver';
export type SoundKind = 'draw' | 'erase' | 'switch' | 'paint' | 'split' | 'crash' | 'deliver' | 'win' | 'start';

export interface Theme {
  id: string;
  name: string;
  drawFloor(ctx: CanvasRenderingContext2D, l: Layout): void;
  /** x, y is the cell's top-left corner. */
  drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number, size: number): void;
  /** x, y is the train's center; angle is its heading in radians (0 = right). */
  drawTrain(ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, angle: number, size: number): void;
  /** t runs from 0 to 1 over the effect's life; x, y is the cell center. */
  drawEffect(ctx: CanvasRenderingContext2D, kind: EffectKind, x: number, y: number, size: number, t: number): void;
  playSound(kind: SoundKind, color?: Color): void;
}
