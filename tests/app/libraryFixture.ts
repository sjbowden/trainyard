import { encodeBoard } from '../../src/engine/codec.ts';
import { emptyBoard, placePiece } from '../../src/app/editor.ts';
import type { LibraryPuzzle } from '../../src/data/library.ts';

/** A one-straight puzzle made with the app's own encoder: outlet at the left of row 3, goal at the right. */
export const CODE = encodeBoard(placePiece(placePiece(emptyBoard(), 21, 'outlet'), 27, 'goal'), { solution: false });

export const puzzle = (id: string, over: Partial<LibraryPuzzle> = {}): LibraryPuzzle => ({
  id, name: `Puzzle ${id}`, creator: 'someone', wrenches: 6, likes: 0, solves: 0, code: CODE, ...over,
});

export const libraryText = (puzzles: LibraryPuzzle[]) => JSON.stringify({ format: 'trainyard-library', version: 1, puzzles });
