import { useEffect, useRef } from 'preact/hooks';
import type { Board } from '../../engine/types.ts';
import type { Theme } from '../theme/theme.ts';
import { fitBoard } from './geometry.ts';
import { renderBoard } from './render.ts';

/** A still picture of a board. */
export function BoardPreview({ board, theme }: { board: Board; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderBoard(ctx, theme, fitBoard(width, height, board.cols, board.rows, 0), board, []);
  }, [board, theme]);
  return <canvas ref={ref} class="preview" />;
}
