import { segmentSides } from '../../engine/codec.ts';
import { segmentFor } from '../../engine/sim.ts';
import type { Color, Piece, Segment, Side } from '../../engine/types.ts';
import type { Layout } from '../board/geometry.ts';
import { synthSound } from './sound.ts';
import type { EffectKind, Theme } from './theme.ts';

/** Our own look: vector shapes on a dark teal floor. Safe to publish. */

export const TRAIN_COLORS: Record<Color, string> = {
  0: '#ff4d5a', // red
  1: '#ffd23f', // yellow
  2: '#3fa7ff', // blue
  3: '#ff9a3c', // orange
  4: '#4fd18b', // green
  5: '#b57bff', // purple
  6: '#a0724a', // brown
};

const FLOOR = '#0f1d21';
const GRID = '#17292e';
const TILE = '#1d3a41';
const RAIL = '#cfe3e6';
const SLEEPER = '#5d7b80';

const DIR: Record<Side, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Strokes the path of a segment, offset sideways by `offset` (for rails). */
function segmentPath(ctx: CanvasRenderingContext2D, seg: Segment, cx: number, cy: number, half: number, offset: number) {
  const sides = segmentSides(seg);
  if (!sides) return;
  const [a, b] = sides.map((s) => DIR[s]) as [[number, number], [number, number]];
  ctx.beginPath();
  if (a[0] === -b[0] && a[1] === -b[1]) {
    // straight: shift perpendicular to the direction of travel
    const px = -a[1] * offset;
    const py = a[0] * offset;
    ctx.moveTo(cx + a[0] * half + px, cy + a[1] * half + py);
    ctx.lineTo(cx + b[0] * half + px, cy + b[1] * half + py);
  } else {
    const kx = cx + (a[0] + b[0]) * half;
    const ky = cy + (a[1] + b[1]) * half;
    const a0 = Math.atan2(a[1] * half + cy - ky, a[0] * half + cx - kx);
    const a1 = Math.atan2(b[1] * half + cy - ky, b[0] * half + cx - kx);
    let delta = a1 - a0;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    ctx.arc(kx, ky, half + offset, a0, a0 + delta, delta < 0);
  }
  ctx.stroke();
}

function drawSegment(ctx: CanvasRenderingContext2D, seg: Segment, x: number, y: number, size: number, alpha: number) {
  if (seg === 0) return;
  const half = size / 2;
  const cx = x + half;
  const cy = y + half;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = SLEEPER;
  ctx.lineWidth = size * 0.42;
  ctx.setLineDash([size * 0.07, size * 0.11]);
  segmentPath(ctx, seg, cx, cy, half, 0);
  ctx.setLineDash([]);
  ctx.strokeStyle = RAIL;
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  segmentPath(ctx, seg, cx, cy, half, size * 0.14);
  segmentPath(ctx, seg, cx, cy, half, -size * 0.14);
  ctx.restore();
}

/** Small colored squares for the trains an outlet holds or a goal still needs. */
function drawColorDots(ctx: CanvasRenderingContext2D, colors: Color[], x: number, y: number, size: number) {
  const n = colors.length;
  if (n === 0) return;
  const perRow = n <= 4 ? 2 : 3;
  const dot = size * (perRow === 2 ? 0.17 : 0.13);
  const gap = dot * 0.35;
  const rows = Math.ceil(n / perRow);
  const w = Math.min(n, perRow) * dot + (Math.min(n, perRow) - 1) * gap;
  const h = rows * dot + (rows - 1) * gap;
  colors.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    ctx.fillStyle = TRAIN_COLORS[c];
    roundRect(ctx, x + (size - w) / 2 + col * (dot + gap), y + (size - h) / 2 + row * (dot + gap), dot, dot, dot * 0.25);
    ctx.fill();
  });
}

/** The trains still to leave an outlet, as small squares along the side opposite its exit. */
function drawTrainStrip(ctx: CanvasRenderingContext2D, colors: Color[], exit: Side, x: number, y: number, size: number) {
  const n = colors.length;
  if (!n) return;
  const dot = Math.min(size * 0.13, (size * 0.7) / n);
  const gap = dot * 0.25;
  const span = n * dot + (n - 1) * gap;
  const vertical = exit === 1 || exit === 3; // exit left/right: strip runs top to bottom on the far side
  const far = size * 0.13;
  colors.forEach((c, i) => {
    const along = (size - span) / 2 + i * (dot + gap);
    let dx: number;
    let dy: number;
    if (vertical) {
      dx = exit === 1 ? far : size - far - dot;
      dy = along;
    } else {
      dx = along;
      dy = exit === 2 ? far : size - far - dot;
    }
    ctx.fillStyle = TRAIN_COLORS[c];
    roundRect(ctx, x + dx, y + dy, dot, dot, dot * 0.25);
    ctx.fill();
  });
}

/** A white bar on the edge of a station showing where trains leave or enter. */
function drawSideMark(ctx: CanvasRenderingContext2D, side: Side, x: number, y: number, size: number, color = '#ffffff') {
  const inset = size * 0.08;
  const len = size * 0.4;
  const thick = size * 0.09;
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.fillStyle = color;
  const [dx, dy] = DIR[side];
  if (dx === 0) roundRect(ctx, cx - len / 2, dy < 0 ? y + inset : y + size - inset - thick, len, thick, thick / 2);
  else roundRect(ctx, dx < 0 ? x + inset : x + size - inset - thick, cy - len / 2, thick, len, thick / 2);
  ctx.fill();
}

function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const inset = size * 0.06;
  ctx.fillStyle = TILE;
  roundRect(ctx, x + inset, y + inset, size - 2 * inset, size - 2 * inset, size * 0.14);
  ctx.fill();
}

export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',

  drawFloor(ctx, l: Layout) {
    ctx.fillStyle = FLOOR;
    ctx.fillRect(l.originX, l.originY, l.cell * l.cols, l.cell * l.rows);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= l.cols; i++) {
      ctx.moveTo(l.originX + i * l.cell, l.originY);
      ctx.lineTo(l.originX + i * l.cell, l.originY + l.rows * l.cell);
    }
    for (let j = 0; j <= l.rows; j++) {
      ctx.moveTo(l.originX, l.originY + j * l.cell);
      ctx.lineTo(l.originX + l.cols * l.cell, l.originY + j * l.cell);
    }
    ctx.stroke();
  },

  drawPiece(ctx, piece: Piece, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    switch (piece.kind) {
      case 'empty':
        return;
      case 'track':
        drawSegment(ctx, piece.secondary, x, y, size, 0.3);
        drawSegment(ctx, piece.primary, x, y, size, 1);
        return;
      case 'rock': {
        ctx.fillStyle = '#56656a';
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.04, size * 0.36, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6f8085';
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.08, cy - size * 0.06, size * 0.2, size * 0.14, -0.4, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 'outlet': {
        drawStation(ctx, x, y, size);
        drawSideMark(ctx, piece.side, x, y, size);
        // the tutorials describe outlets by their plus sign
        ctx.strokeStyle = '#cfe3e6';
        ctx.lineWidth = size * 0.07;
        ctx.lineCap = 'round';
        const arm = size * 0.13;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
        ctx.stroke();
        drawTrainStrip(ctx, piece.colors, piece.side, x, y, size);
        return;
      }
      case 'goal': {
        drawStation(ctx, x, y, size);
        for (const s of piece.sides) drawSideMark(ctx, s, x, y, size);
        ctx.strokeStyle = '#8fa9ae';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        drawColorDots(ctx, piece.colors, x, y, size);
        return;
      }
      case 'painter': {
        const seg = segmentFor(piece.a, piece.b);
        drawSegment(ctx, seg, x, y, size, 1);
        ctx.fillStyle = TRAIN_COLORS[piece.color];
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = size * 0.04;
        ctx.stroke();
        return;
      }
      case 'splitter': {
        ctx.fillStyle = TILE;
        ctx.beginPath();
        ctx.moveTo(cx, y + size * 0.1);
        ctx.lineTo(x + size * 0.9, cy);
        ctx.lineTo(cx, y + size * 0.9);
        ctx.lineTo(x + size * 0.1, cy);
        ctx.closePath();
        ctx.fill();
        drawSideMark(ctx, piece.in, x, y, size);
        // arrows toward the two exits
        ctx.strokeStyle = '#cfe3e6';
        ctx.lineWidth = size * 0.06;
        ctx.lineCap = 'round';
        for (const out of [((piece.in + 1) % 4) as Side, ((piece.in + 3) % 4) as Side]) {
          const [dx, dy] = DIR[out];
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * size * 0.28, cy + dy * size * 0.28);
          ctx.stroke();
        }
        return;
      }
    }
  },

  drawTrain(ctx, color, x, y, angle, size) {
    const len = size * 0.5;
    const wid = size * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -len / 2 + 2, -wid / 2 + 3, len, wid, wid * 0.3);
    ctx.fill();
    ctx.fillStyle = TRAIN_COLORS[color];
    roundRect(ctx, -len / 2, -wid / 2, len, wid, wid * 0.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, len * 0.12, -wid / 2 + wid * 0.15, len * 0.3, wid * 0.7, wid * 0.2);
    ctx.fill();
    ctx.restore();
  },

  drawEffect(ctx, kind: EffectKind, x, y, size, t) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    if (kind === 'crash') {
      ctx.fillStyle = '#ff5a5f';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = size * (0.15 + 0.45 * t);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, size * 0.08 * (1 - t / 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = kind === 'deliver' ? '#4fd18b' : '#ffffff';
      ctx.lineWidth = size * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, size * (0.2 + 0.35 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  playSound: synthSound,
};

