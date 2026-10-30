import type { Board, Color, Piece, Segment, Side } from './types.ts';

/** Reads and writes the original game's puzzle/solution codes (see docs/rules.md). */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
/** The last alphabet character also separates puzzle from solution, so no value may use it. */
const SEPARATOR = '_';
const MAX_SIZE = 62;
const MAX_OUTLET_TRAINS = 9;
const MAX_GOAL_TRAINS = 63;

const SEGMENT_SIDES: readonly ([Side, Side] | null)[] = [null, [0, 1], [0, 3], [2, 3], [2, 1], [0, 2], [3, 1]];

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodecError';
  }
}

export function segmentSides(s: Segment): [Side, Side] | null {
  return SEGMENT_SIDES[s] ?? null;
}

export function splitCode(code: string): { puzzle: string; solution: string } {
  const i = code.indexOf(SEPARATOR);
  return i === -1 ? { puzzle: code, solution: '' } : { puzzle: code.slice(0, i), solution: code.slice(i + 1) };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function valueOf(ch: string | undefined, max: number, what: string): number {
  if (ch === undefined) throw new CodecError(`Code ends in the middle of ${what}`);
  const v = ALPHABET.indexOf(ch);
  if (v < 0 || v >= max) throw new CodecError(`Invalid character '${ch}' for ${what}`);
  return v;
}

/** Reads n colors packed two per character, starting at s[at]. Returns the colors and characters used. */
function readColors(s: string, at: number, n: number, what: string): [Color[], number] {
  const colors: Color[] = [];
  let used = 0;
  while (colors.length < n) {
    const v = valueOf(s[at + used], 49, what);
    colors.push(Math.floor(v / 7) as Color);
    if (colors.length < n) colors.push((v % 7) as Color);
    used++;
  }
  return [colors, used];
}

/** Decodes one piece token at the start of s. Returns the piece and its length. */
function readPiece(s: string): [Piece, number] {
  switch (s[0]) {
    case 'R':
      return [{ kind: 'rock' }, 1];
    case 'S':
      return [{ kind: 'splitter', in: valueOf(s[1], 4, 'a splitter') as Side }, 2];
    case 'P': {
      const color = valueOf(s[1], 7, 'a painter') as Color;
      const v = valueOf(s[2], 28, 'a painter');
      if (v % 7 >= 4) throw new CodecError(`Invalid character '${s[2]}' for a painter`);
      return [{ kind: 'painter', color, a: Math.floor(v / 7) as Side, b: (v % 7) as Side }, 3];
    }
    case 'O': {
      const v = valueOf(s[1], 4 * MAX_OUTLET_TRAINS, 'an outlet');
      const [colors, used] = readColors(s, 2, (v % MAX_OUTLET_TRAINS) + 1, 'an outlet');
      return [{ kind: 'outlet', side: Math.floor(v / MAX_OUTLET_TRAINS) as Side, colors }, 2 + used];
    }
    case 'G': {
      const mask = valueOf(s[1], 16, 'a goal');
      const n = valueOf(s[2], MAX_GOAL_TRAINS, 'a goal') + 1;
      const [colors, used] = readColors(s, 3, n, 'a goal');
      const sides = ([0, 1, 2, 3] as Side[]).filter((side) => mask & (1 << side));
      return [{ kind: 'goal', sides, colors }, 3 + used];
    }
    default:
      throw new CodecError(`Invalid character '${s[0]}' in puzzle`);
  }
}

/**
 * A run-length reader over one part of a code. Digits 1-9 stand for that many
 * "skipped" cells, 0 for ten. Anything else is a token for the current cell.
 */
class RunReader {
  private count = 0;
  constructor(public rest: string) {}

  /** Advances one cell. Returns true if the cell is skipped (or the part has ended). */
  skip(): boolean {
    const ch = this.rest[0];
    if (ch === undefined) return true;
    if (!isDigit(ch)) return false;
    this.count++;
    if (this.count === Number(ch) || (ch === '0' && this.count === 10)) {
      this.rest = this.rest.slice(1);
      this.count = 0;
    }
    return true;
  }

  get done(): boolean {
    return this.rest.length === 0 && this.count === 0;
  }
}

export function decodeBoard(code: string): Board {
  if (code.length < 2) throw new CodecError('Code is too short');
  const cols = valueOf(code[0], MAX_SIZE + 1, 'the width');
  const rows = valueOf(code[1], MAX_SIZE + 1, 'the height');
  if (cols === 0 || rows === 0) throw new CodecError('Board has no cells');
  const { puzzle, solution } = splitCode(code.slice(2));
  const p = new RunReader(puzzle);
  const t = new RunReader(solution);
  const cells: Piece[] = [];

  for (let i = 0; i < cols * rows; i++) {
    let piece: Piece = { kind: 'empty' };
    if (!p.skip()) {
      const [decoded, len] = readPiece(p.rest);
      piece = decoded;
      p.rest = p.rest.slice(len);
    }
    if (!t.skip()) {
      const v = valueOf(t.rest[0], 49, 'track');
      t.rest = t.rest.slice(1);
      if (piece.kind === 'empty') {
        piece = { kind: 'track', primary: Math.floor(v / 7) as Segment, secondary: (v % 7) as Segment };
      }
    }
    cells.push(piece);
  }
  if (!p.done || !t.done) throw new CodecError('Code has more cells than the board');
  return { cols, rows, cells };
}

/** Checks that a value is a whole number in [min, max] and returns it. */
function checked(v: number, min: number, max: number, what: string): number {
  if (!Number.isInteger(v) || v < min || v > max) throw new CodecError(`Cannot encode ${what} ${v}`);
  return v;
}

const side = (v: number) => checked(v, 0, 3, 'side');
const color = (v: number) => checked(v, 0, 6, 'color');
const segment = (v: number) => checked(v, 0, 6, 'track segment');

function packColors(colors: Color[]): string {
  let out = '';
  for (let i = 0; i < colors.length; i += 2) out += ALPHABET[color(colors[i]!) * 7 + color(colors[i + 1] ?? 0)];
  return out;
}

function encodePiece(piece: Piece): string {
  switch (piece.kind) {
    case 'rock':
      return 'R';
    case 'splitter':
      return 'S' + ALPHABET[side(piece.in)];
    case 'painter':
      return 'P' + ALPHABET[color(piece.color)] + ALPHABET[side(piece.a) * 7 + side(piece.b)];
    case 'outlet': {
      const n = checked(piece.colors.length, 1, MAX_OUTLET_TRAINS, 'an outlet holding trains:');
      return 'O' + ALPHABET[side(piece.side) * MAX_OUTLET_TRAINS + n - 1] + packColors(piece.colors);
    }
    case 'goal': {
      const n = checked(piece.colors.length, 1, MAX_GOAL_TRAINS, 'a goal needing trains:');
      const mask = piece.sides.reduce<number>((m, s) => m | (1 << side(s)), 0);
      return 'G' + ALPHABET[mask] + ALPHABET[n - 1] + packColors(piece.colors);
    }
    default:
      throw new CodecError(`Cannot encode a ${piece.kind} as a puzzle piece`);
  }
}

/** Run-length encodes the cells, writing a token for cells where tokenFor returns one. */
function encodePart(cells: Piece[], tokenFor: (p: Piece) => string | null): string {
  let out = '';
  let run = 0;
  let tokens = 0;
  for (const cell of cells) {
    const token = tokenFor(cell);
    if (token === null) {
      if (++run === 10) {
        out += '0';
        run = 0;
      }
    } else {
      if (run > 0) out += run;
      run = 0;
      out += token;
      tokens++;
    }
  }
  return tokens === 0 ? '' : out;
}

/**
 * Throws CodecError for boards the format cannot represent. A run's live board (Run.board)
 * is one of them once outlets or goals empty, so encode the original board, not the run's.
 */
export function encodeBoard(board: Board, parts: { puzzle?: boolean; solution?: boolean } = {}): string {
  const { puzzle = true, solution = true } = parts;
  const cols = checked(board.cols, 1, MAX_SIZE, 'a board width');
  const rows = checked(board.rows, 1, MAX_SIZE, 'a board height');
  if (board.cells.length !== cols * rows) throw new CodecError('Board has the wrong number of cells');
  let out = ALPHABET[cols]! + ALPHABET[rows]!;
  if (puzzle) {
    out += encodePart(board.cells, (c) => (c.kind === 'empty' || c.kind === 'track' ? null : encodePiece(c)));
  }
  if (solution) {
    const s = encodePart(board.cells, (c) => (c.kind === 'track' ? ALPHABET[segment(c.primary) * 7 + segment(c.secondary)]! : null));
    if (s) out += SEPARATOR + s;
  }
  return out;
}
