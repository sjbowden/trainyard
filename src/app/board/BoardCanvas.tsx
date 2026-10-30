import { useEffect, useRef } from 'preact/hooks';
import type { Board } from '../../engine/types.ts';
import { drawPath, eraseCells } from '../editing.ts';
import type { Theme } from '../theme/theme.ts';
import { trainPose } from './animation.ts';
import { cellAt, fitBoard, type Layout } from './geometry.ts';
import type { PuzzleController } from './player.ts';
import { renderBoard, type DrawnEffect } from './render.ts';

export interface BoardCanvasProps {
  controller: PuzzleController;
  theme: Theme;
  mode: 'draw' | 'erase';
  speed: number;
  /** Effects to draw, added by the screen as run events arrive; times are performance.now() ms. */
  effects: { current: (DrawnEffect & { born: number })[] };
  /** Called after the player changes the drawn board, so the screen can refresh its buttons. */
  onEdit: () => void;
}

const EFFECT_MS = 600;

export function BoardCanvas({ controller, theme, mode, speed, effects, onEdit }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ controller, theme, mode, speed, onEdit });
  props.current = { controller, theme, mode, speed, onEdit };
  const layout = useRef<Layout | null>(null);
  const drag = useRef<{ cells: number[]; moved: boolean; preview: Board | null } | null>(null);
  const dirty = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const b = props.current.controller.board;
      layout.current = fitBoard(width, height, b.cols, b.rows, 0);
      dirty.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { controller: c, theme: th, speed: sp } = props.current;
      const l = layout.current;
      if (c.running) c.advance(dt, sp);
      effects.current = effects.current.filter((e) => now - e.born < EFFECT_MS);
      if (l && (dirty.current || c.running || effects.current.length)) {
        dirty.current = false;
        const p = c.playing;
        const board = p ? p.run.board : (drag.current?.preview ?? c.board);
        const trains = p
          ? p.run.trains.filter((t) => t.alive).map((t) => ({ color: t.color, ...trainPose(t.cell, t.entry, t.nextSide, p.progress, l) }))
          : [];
        const { width, height } = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, width, height);
        renderBoard(ctx, th, l, board, trains, effects.current.map((e) => ({ ...e, t: (now - e.born) / EFFECT_MS })));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Redraw when the drawn board changes from outside (undo, clear, stop).
  useEffect(() => {
    dirty.current = true;
  });

  const cellFromEvent = (e: PointerEvent): number | null => {
    const l = layout.current;
    if (!l) return null;
    const r = canvasRef.current!.getBoundingClientRect();
    return cellAt(l, e.clientX - r.left, e.clientY - r.top);
  };

  const preview = (cells: number[]) => {
    const { controller: c, mode: m } = props.current;
    return m === 'draw' ? drawPath(c.board, cells) : eraseCells(c.board, cells);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (props.current.controller.running) return;
    const cell = cellFromEvent(e);
    if (cell === null) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { cells: [cell], moved: false, preview: null };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const cell = cellFromEvent(e);
    if (cell === null || cell === d.cells[d.cells.length - 1]) return;
    d.cells.push(cell);
    d.moved = true;
    d.preview = preview(d.cells);
    dirty.current = true;
    props.current.theme.playSound(props.current.mode === 'draw' ? 'draw' : 'erase');
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const { controller: c, mode: m, theme: th } = props.current;
    if (!d.moved) {
      if (m === 'erase') c.erase(d.cells);
      else if (c.tap(d.cells[0]!)) th.playSound('switch');
    } else if (m === 'draw') c.draw(d.cells);
    else c.erase(d.cells);
    dirty.current = true;
    props.current.onEdit();
  };

  return (
    <canvas
      ref={canvasRef}
      class="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
