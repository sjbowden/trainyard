import { describe, expect, test } from 'vitest';
import { encodeBoard } from '../../src/engine/codec.ts';
import { emptyBoard, placePiece } from '../../src/app/editor.ts';
import { buildLibraryFile, LibraryError, parseLibrary, type ScrapedPuzzle } from '../../src/data/library.ts';

// Codes made with the app's own encoder: no scraped puzzle codes in the repo.
const code = (outlet: number, goal: number) => encodeBoard(placePiece(placePiece(emptyBoard(), outlet, 'outlet'), goal, 'goal'), { solution: false });

const scraped = (id: string, over: Partial<ScrapedPuzzle> = {}): ScrapedPuzzle => ({
  id, encodedID: `P${id}`, name: `Puzzle ${id}`, creator: 'someone', wrenches: 6, likes: 10, solves: 20, code: code(21, 27), ...over,
});

describe('buildLibraryFile', () => {
  test('keeps decodable puzzles with codes and drops the rest', () => {
    const built = buildLibraryFile({ puzzles: { 1: scraped('1'), 2: scraped('2', { code: null }), 3: scraped('3', { code: 'zz!' }) } });
    expect([built.kept, built.dropped]).toEqual([1, 2]);
    const { encodedID: _, ...expected } = scraped('1');
    expect(JSON.parse(built.text).puzzles).toEqual([expected]);
  });

  test("a featured puzzle the feeds didn't list gets wrenches and likes of 0, not null", () => {
    const built = buildLibraryFile({ puzzles: { 1: scraped('1', { wrenches: null, likes: null, featured: { set: 'Lorne Park', order: 2 } }) } });
    expect(JSON.parse(built.text).puzzles[0]).toMatchObject({ wrenches: 0, likes: 0, featured: { set: 'Lorne Park', order: 2 } });
  });
});

describe('parseLibrary', () => {
  test('round-trips buildLibraryFile', () => {
    const built = buildLibraryFile({ puzzles: { 1: scraped('1'), 4: scraped('4', { code: code(0, 6), name: 'Quotes " and <b>tags</b> 🚂' }) } });
    const parsed = parseLibrary(built.text);
    expect(parsed.dropped).toBe(0);
    expect(parsed.puzzles).toEqual(JSON.parse(built.text).puzzles);
  });

  test('a library file from a newer version of the app says so', () => {
    expect(() => parseLibrary(JSON.stringify({ format: 'trainyard-library', version: 2, puzzles: [] }))).toThrow('This library file needs a newer version of the app.');
  });

  test('a puzzle id listed twice keeps only the first', () => {
    const built = JSON.parse(buildLibraryFile({ puzzles: { 1: scraped('1'), 4: scraped('4', { code: code(0, 6) }) } }).text);
    built.puzzles[1].id = '1';
    const parsed = parseLibrary(JSON.stringify(built));
    expect(parsed.puzzles.map((p) => p.code)).toEqual([built.puzzles[0].code]);
    expect(parsed.dropped).toBe(1);
  });

  test('a code that carries a solution is dropped', () => {
    const built = JSON.parse(buildLibraryFile({ puzzles: { 1: scraped('1'), 2: scraped('2') } }).text);
    built.puzzles[1].code += '_abc';
    expect(parseLibrary(JSON.stringify(built)).puzzles.map((p) => p.id)).toEqual(['1']);
  });

  test('refuses other files', () => {
    for (const text of ['not json', '{}', 'null', JSON.stringify({ format: 'trainyard-library', version: 1 })]) {
      expect(() => parseLibrary(text)).toThrow(LibraryError);
      expect(() => parseLibrary(text)).toThrow("That file isn't a Trainyard library.");
    }
  });

  test("drops an entry that won't decode or is missing a field, and counts it", () => {
    const { encodedID: _, ...good } = scraped('1');
    const text = JSON.stringify({
      format: 'trainyard-library',
      version: 1,
      puzzles: [good, { ...good, id: '2', code: 'zz!' }, { ...good, id: '3', creator: undefined }, { ...good, id: '4', likes: 'many' }, null],
    });
    expect(parseLibrary(text)).toEqual({ puzzles: [good], dropped: 4 });
  });
});
