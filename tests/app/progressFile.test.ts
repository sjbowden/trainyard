import { expect, test } from 'vitest';
import { emptyProgress, recordAttempt, type Progress } from '../../src/app/progress.ts';
import { mergeProgress, parseProgressFile, ProgressFileError, progressFileName, progressFileText } from '../../src/app/progressFile.ts';

const p = (levels: Progress['levels']): Progress => ({ levels });

test('a save stamps when the track was laid', () => {
  expect(recordAttempt(emptyProgress(), 'trainyard/redLine', 'abc', true, 1234).levels['trainyard/redLine']).toEqual({ solved: true, solution: 'abc', at: 1234 });
});

test('the file round-trips the original puzzles and the library, and leaves out your own puzzles', () => {
  const mine = p({
    'trainyard/redLine': { solved: true, solution: 'abc', at: 5 },
    'express/x': { solved: false, solution: 'd' },
    'library/42': { solved: true, solution: 'e', at: 7 },
    'custom/m1': { solved: true, solution: 'f', at: 9 },
  });
  const read = parseProgressFile(progressFileText(mine, new Date('2026-11-01T12:00:00Z')));
  expect(read).toEqual(p({ 'trainyard/redLine': mine.levels['trainyard/redLine']!, 'express/x': mine.levels['express/x']!, 'library/42': mine.levels['library/42']! }));
});

test('the file is named for the day it was saved', () => {
  expect(progressFileName(new Date(2026, 10, 1, 23, 30))).toBe('trainyard-progress-2026-11-01.json');
});

test('refuses files that are not progress files', () => {
  for (const text of ['not json', '{}', 'null', JSON.stringify({ format: 'trainyard-library', version: 1, puzzles: [] })]) {
    expect(() => parseProgressFile(text)).toThrow(ProgressFileError);
    expect(() => parseProgressFile(text)).toThrow("That file isn't a Trainyard progress file.");
  }
});

test('a progress file from a newer version of the app says so', () => {
  expect(() => parseProgressFile(JSON.stringify({ format: 'trainyard-progress', version: 2, levels: {} }))).toThrow('This progress file needs a newer version of the app.');
});

test('skips entries it cannot read', () => {
  const text = JSON.stringify({
    format: 'trainyard-progress',
    version: 1,
    levels: { 'trainyard/a': { solved: true, solution: 'x' }, 'trainyard/b': { solved: 'yes', solution: 'x' }, 'trainyard/c': { solved: true }, 'trainyard/d': null, 'trainyard/e': { solved: true, solution: 'x', at: 'noon' } },
  });
  expect(parseProgressFile(text)).toEqual(p({ 'trainyard/a': { solved: true, solution: 'x' } }));
});

test('merging: solved on either device counts, and each puzzle keeps the newer track', () => {
  const here = p({ a: { solved: true, solution: 'old', at: 1 }, b: { solved: false, solution: 'newer', at: 9 }, c: { solved: false, solution: 'only here', at: 3 } });
  const there = p({ a: { solved: false, solution: 'new', at: 2 }, b: { solved: true, solution: 'older', at: 4 }, d: { solved: true, solution: 'only there', at: 5 } });
  expect(mergeProgress(here, there)).toEqual({
    progress: p({
      a: { solved: true, solution: 'new', at: 2 },
      b: { solved: true, solution: 'newer', at: 9 },
      c: { solved: false, solution: 'only here', at: 3 },
      d: { solved: true, solution: 'only there', at: 5 },
    }),
    newlySolved: 2,
  });
});

test('merging: a track with no time counts as oldest, and a tie keeps this device', () => {
  const here = p({ a: { solved: true, solution: 'untimed' }, b: { solved: true, solution: 'here', at: 4 } });
  const there = p({ a: { solved: true, solution: 'timed', at: 1 }, b: { solved: true, solution: 'there', at: 4 } });
  expect(mergeProgress(here, there)).toEqual({
    progress: p({ a: { solved: true, solution: 'timed', at: 1 }, b: { solved: true, solution: 'here', at: 4 } }),
    newlySolved: 0,
  });
});
