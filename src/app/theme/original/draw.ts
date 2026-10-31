import { segmentSides } from '../../../engine/codec.ts';
import { segmentFor } from '../../../engine/sim.ts';
import type { Color, Segment, Side } from '../../../engine/types.ts';
import { defaultTheme, TRAIN_COLORS } from '../default.ts';
import type { Theme } from '../theme.ts';
import { FRAMES, TILE, type FrameName } from './frames.ts';

/** The images the Original theme draws from. */
export interface Sprites {
  atlas: CanvasImageSource;
  /** One empty floor tile, TILE px square. */
  floor: CanvasImageSource;
  /** A frame tinted with a train color, as its own image the frame's size. */
  tinted(name: FrameName, color: Color): CanvasImageSource;
}

/** Builds the sprites with offscreen canvases. Tinted frames are made once per color, on first use. */
export function canvasSprites(atlas: CanvasImageSource, make = (w: number, h: number) => new OffscreenCanvas(w, h)): Sprites {
  const q = FRAMES.floorQuarter;
  const floorCanvas = make(TILE, TILE);
  const f = floorCanvas.getContext('2d')!;
  // the quarter is the top-right one; mirror it into the other three
  for (const [mx, my] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    f.setTransform(mx, 0, 0, my, TILE / 2, TILE / 2);
    f.drawImage(atlas, q.x, q.y, q.w, q.h, 0, -q.h, q.w, q.h);
  }
  const cache = new Map<string, CanvasImageSource>();
  return {
    atlas,
    floor: floorCanvas,
    tinted(name, color) {
      const key = `${name}:${color}`;
      let img = cache.get(key);
      if (!img) {
        const fr = FRAMES[name];
        const c = make(fr.w, fr.h);
        const t = c.getContext('2d')!;
        t.drawImage(atlas, fr.x, fr.y, fr.w, fr.h, 0, 0, fr.w, fr.h);
        // multiply keeps the art's shading; destination-in puts back its transparency
        t.globalCompositeOperation = 'multiply';
        t.fillStyle = TRAIN_COLORS[color];
        t.fillRect(0, 0, fr.w, fr.h);
        t.globalCompositeOperation = 'destination-in';
        t.drawImage(atlas, fr.x, fr.y, fr.w, fr.h, 0, 0, fr.w, fr.h);
        img = c;
        cache.set(key, img);
      }
      return img;
    },
  };
}

/** A quarter turn clockwise per `rot`, after mirroring left to right when `mirror`. */
interface Turn { rot: number; mirror: boolean }
const TURNS: Turn[] = [0, 1, 2, 3].flatMap((rot) => [{ rot, mirror: false }, { rot, mirror: true }]);

const turnSide = (s: Side, t: Turn): Side => (((t.mirror && s % 2 === 1 ? 4 - s : s) + t.rot) % 4) as Side;
function turnSegment(seg: Segment, t: Turn): Segment {
  const sides = segmentSides(seg);
  return sides ? segmentFor(turnSide(sides[0], t), turnSide(sides[1], t)) : 0;
}

/** The atlas's track tiles, each with the primary and secondary segments it shows untouched. */
const TRACK_TILES: { frame: FrameName; primary: Segment; secondary: Segment }[] = [
  { frame: 'straight', primary: 5, secondary: 0 },
  { frame: 'curve', primary: 3, secondary: 0 },
  { frame: 'cross', primary: 5, secondary: 6 },
  { frame: 'cross', primary: 6, secondary: 5 },
  { frame: 'switchCurves', primary: 3, secondary: 4 },
  { frame: 'curveStraight', primary: 3, secondary: 5 },
  { frame: 'straightCurve', primary: 5, secondary: 3 },
];

function findTile(primary: Segment, secondary: Segment): { frame: FrameName; turn: Turn } | null {
  for (const tile of TRACK_TILES) {
    for (const turn of TURNS) {
      if (turnSegment(tile.primary, turn) === primary && turnSegment(tile.secondary, turn) === secondary) return { frame: tile.frame, turn };
    }
  }
  return null;
}

// Corners of a unit cell, clockwise from the top-left; side s runs from corner s to corner s+1.
const CORNERS: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** Clips to the triangles between the cell's center and the given sides. */
function clipToSides(ctx: CanvasRenderingContext2D, sides: Side[], x: number, y: number, size: number) {
  ctx.beginPath();
  for (const s of sides) {
    const [ax, ay] = CORNERS[s]!;
    const [bx, by] = CORNERS[(s + 1) % 4]!;
    ctx.moveTo(x + size / 2, y + size / 2);
    ctx.lineTo(x + ax * size, y + ay * size);
    ctx.lineTo(x + bx * size, y + by * size);
    ctx.closePath();
  }
  ctx.clip();
}

export function originalDrawing(sprites: Sprites): Pick<Theme, 'drawFloor' | 'drawPiece' | 'drawTrain' | 'drawEffect'> {
  const { atlas } = sprites;

  /** Draws a frame centered in the cell, scaled from the 96 px tile, turned. */
  function frame(ctx: CanvasRenderingContext2D, name: FrameName, x: number, y: number, size: number, turn: Turn = { rot: 0, mirror: false }) {
    const f = FRAMES[name];
    const w = (f.w * size) / TILE;
    const h = (f.h * size) / TILE;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    if (turn.rot) ctx.rotate((turn.rot * Math.PI) / 2);
    if (turn.mirror) ctx.scale(-1, 1);
    ctx.drawImage(atlas, f.x, f.y, f.w, f.h, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function track(ctx: CanvasRenderingContext2D, primary: Segment, secondary: Segment, x: number, y: number, size: number) {
    if (!primary && !secondary) return;
    if (!primary) {
      // a lone segment stored as the secondary carries trains; show it dimmed, as the default theme does
      ctx.save();
      ctx.globalAlpha = 0.45;
      track(ctx, secondary, 0, x, y, size);
      ctx.restore();
      return;
    }
    const tile = findTile(primary, secondary);
    if (tile) return frame(ctx, tile.frame, x, y, size, tile.turn);
    // two curves on opposite corners, which never switch: draw each in its own half of the cell
    track(ctx, primary, 0, x, y, size);
    const corner = segmentSides(secondary)!;
    ctx.save();
    clipToSides(ctx, corner, x, y, size);
    track(ctx, secondary, 0, x, y, size);
    ctx.restore();
  }

  /** The station's train icons, row by row in a 1, 2×2, 3×3 or 4×4 grid inside its box. */
  function icons(ctx: CanvasRenderingContext2D, kind: 'outlet' | 'goal', colors: Color[], x: number, y: number, size: number) {
    if (!colors.length) return;
    const grid = colors.length <= 1 ? 1 : colors.length <= 4 ? 2 : colors.length <= 9 ? 3 : 4;
    const name = `${kind}Nub${grid * grid}` as FrameName;
    const icon = (FRAMES[name].w * size) / TILE;
    const inner = (56 * size) / TILE;
    const pitch = inner / grid;
    colors.slice(0, 16).forEach((color, i) => {
      const cx = x + (size - inner) / 2 + pitch * ((i % grid) + 0.5);
      const cy = y + (size - inner) / 2 + pitch * (Math.floor(i / grid) + 0.5);
      ctx.drawImage(sprites.tinted(name, color), cx - icon / 2, cy - icon / 2, icon, icon);
    });
  }

  return {
    drawFloor(ctx, l) {
      for (let i = 0; i < l.cols * l.rows; i++) {
        ctx.drawImage(sprites.floor, l.originX + (i % l.cols) * l.cell, l.originY + Math.floor(i / l.cols) * l.cell, l.cell, l.cell);
      }
    },

    drawPiece(ctx, piece, x, y, size) {
      switch (piece.kind) {
        case 'empty':
          return;
        case 'track':
          return track(ctx, piece.primary, piece.secondary, x, y, size);
        case 'rock':
          return frame(ctx, 'rock', x, y, size);
        case 'outlet':
          // the outlet tile leaves by the bottom
          frame(ctx, 'outlet', x, y, size, { rot: (piece.side + 2) % 4, mirror: false });
          frame(ctx, 'outletBox', x, y, size);
          return icons(ctx, 'outlet', piece.colors, x, y, size);
        case 'goal':
          for (const s of [0, 1, 2, 3] as Side[]) {
            ctx.save();
            clipToSides(ctx, [s], x, y, size);
            // the open tile's bottom quarter is an entry; the closed tile's top quarter is a wall
            if (piece.sides.includes(s)) frame(ctx, 'goalOpen', x, y, size, { rot: (s + 2) % 4, mirror: false });
            else frame(ctx, 'goalClosed', x, y, size, { rot: s, mirror: false });
            ctx.restore();
          }
          frame(ctx, piece.colors.length ? 'goalBox' : 'goalDone', x, y, size);
          return icons(ctx, 'goal', piece.colors, x, y, size);
        case 'painter': {
          track(ctx, segmentFor(piece.a, piece.b), 0, x, y, size);
          const w = (FRAMES.painter.w * size) / TILE;
          ctx.drawImage(sprites.tinted('painter', piece.color), x + (size - w) / 2, y + (size - w) / 2, w, w);
          return;
        }
        case 'splitter': {
          // the cross without the arm opposite the entry
          const sides = [piece.in, (piece.in + 1) % 4, (piece.in + 3) % 4] as Side[];
          ctx.save();
          clipToSides(ctx, sides, x, y, size);
          frame(ctx, 'cross', x, y, size);
          ctx.restore();
          // the scissors' handles face the entry
          frame(ctx, 'splitter', x, y, size, { rot: (piece.in + 2) % 4, mirror: false });
          return;
        }
      }
    },

    drawTrain(ctx, color, x, y, angle, size) {
      const w = (FRAMES.train.w * size) / TILE;
      const h = (FRAMES.train.h * size) / TILE;
      ctx.save();
      ctx.translate(x, y);
      // the sprite's nose points up; angle 0 is heading right
      ctx.rotate(angle + Math.PI / 2);
      ctx.drawImage(sprites.tinted('train', color), -w / 2, -h / 2, w, h);
      ctx.restore();
    },

    drawEffect: defaultTheme.drawEffect,
  };
}
