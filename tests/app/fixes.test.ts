import 'fake-indexeddb/auto';
import { clear, createStore, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DebouncedSave } from '../../src/app/saver.ts';
import { StrokeTracker } from '../../src/app/board/strokes.ts';
import { loadProgress, saveProgress } from '../../src/app/store.ts';
import { Player } from '../../src/app/board/player.ts';
import { nextLevel } from '../../src/app/levels.ts';
import { emptyProgress, levelKey, recordAttempt } from '../../src/app/progress.ts';
import { drawPath, History } from '../../src/app/editing.ts';
import { unlockAudio } from '../../src/app/theme/sound.ts';
import type { Collection } from '../../src/data/apk.ts';
import { SEGMENT, SIDE } from '../../src/engine/types.ts';
import { at, board, dummyGoal, outlet, track } from '../engine/helpers.ts';

describe('saving the drawing', () => {
  test('flush saves a pending value at once and only once', () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const s = new DebouncedSave<string>((v) => saved.push(v), 500);
    s.schedule('a');
    s.schedule('b');
    s.flush();
    vi.advanceTimersByTime(1000);
    expect(saved).toEqual(['b']);
    vi.useRealTimers();
  });
});

describe('strokes follow one finger', () => {
  test('a second finger is ignored until the first lifts', () => {
    const t = new StrokeTracker();
    t.down(1, 22);
    t.down(2, 5); // stray thumb
    t.move(2, 12);
    t.move(1, 23);
    expect(t.up(2)).toBeNull();
    t.move(1, 24);
    expect(t.up(1)).toEqual({ cells: [22, 23, 24], moved: true });
  });

  test('a canceled stroke is discarded', () => {
    const t = new StrokeTracker();
    t.down(1, 22);
    t.move(1, 23);
    t.cancel(1);
    expect(t.active).toBe(false);
    expect(t.up(1)).toBeNull();
  });
});

describe('progress is never wiped', () => {
  const kv = () => createStore('trainyard', 'kv');
  beforeEach(() => clear(kv()));
  afterEach(() => vi.restoreAllMocks());

  test('saving merges with what is stored, keeping every solve', async () => {
    await set('progress/v1', { levels: { 'trainyard/a': { solved: true, solution: 'x' } } }, kv());
    // a session that failed to read progress only knows about the level it touched
    await saveProgress({ levels: { 'trainyard/b': { solved: false, solution: 'y' } } });
    expect((await loadProgress()).levels).toEqual({
      'trainyard/a': { solved: true, solution: 'x' },
      'trainyard/b': { solved: false, solution: 'y' },
    });
  });

  test('a solve stored earlier survives a later unsolved save of the same level', async () => {
    await set('progress/v1', { levels: { 'trainyard/a': { solved: true, solution: 'x' } } }, kv());
    await saveProgress({ levels: { 'trainyard/a': { solved: false, solution: 'z' } } });
    expect((await loadProgress()).levels['trainyard/a']).toEqual({ solved: true, solution: 'z' });
  });

  test('a storage open that never answers gives up instead of hanging', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => ({}) as IDBOpenDBRequest);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const p = loadProgress();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toEqual(emptyProgress());
    vi.useRealTimers();
  });
});

test('a looping run is stopped as soon as it repeats', () => {
  const loop = board({ '1,2': outlet(SIDE.R, 0), '2,2': track(SEGMENT.LR, SEGMENT.BR), '3,2': track(SEGMENT.BL), '3,3': track(SEGMENT.TL), '2,3': track(SEGMENT.TR), ...dummyGoal });
  const p = new Player(loop, () => {});
  for (let i = 0; i < 100 && !p.finished; i++) p.advance(0.5, 1);
  expect(p.finished).toBe('stopped');
  expect(p.run.halfSteps).toBeLessThan(40);
});

describe('next puzzle', () => {
  const c: Collection = {
    id: 'trainyard',
    worlds: [
      { slug: 'a', name: 'A', starsToUnlock: 0, group: 'main', ordinal: 0 },
      { slug: 'b', name: 'B', starsToUnlock: 2, group: 'main', ordinal: 1 },
    ],
    levels: [
      { slug: 'a2', worldSlug: 'a', name: 'A2', stars: 1, code: 'hh', ordinal: 2 },
      { slug: 'a1', worldSlug: 'a', name: 'A1', stars: 1, code: 'hh', ordinal: 1 },
      { slug: 'b1', worldSlug: 'b', name: 'B1', stars: 1, code: 'hh', ordinal: 1 },
    ],
    tutorials: [],
  };
  test('goes to the next level in the city', () => {
    expect(nextLevel(c, 'a1', emptyProgress())?.slug).toBe('a2');
  });
  test('does not go into a locked city', () => {
    expect(nextLevel(c, 'a2', emptyProgress())).toBeUndefined();
    const p = recordAttempt(recordAttempt(emptyProgress(), levelKey('trainyard', 'a1'), 'x', true), levelKey('trainyard', 'a2'), 'x', true);
    expect(nextLevel(c, 'a2', p)?.slug).toBe('b1');
  });
});

test('undo history ignores strokes that change nothing', () => {
  const b = board({});
  const h = new History(b);
  h.push(drawPath(b, [at(1, 1), at(2, 1)])); // two cells lay no track
  expect(h.canUndo).toBe(false);
});

test('a fast diagonal swipe fills a staircase along the line', () => {
  const b = drawPath(board({}), [at(0, 0), at(2, 2)]);
  // (0,0) → (1,0) → (1,1) → (2,1) → (2,2): corners follow the finger, not one big L
  expect(b.cells[at(1, 1)]).toEqual(track(SEGMENT.TR));
  expect(b.cells[at(2, 0)]).toEqual({ kind: 'empty' });
});

describe('audio on iPhone', () => {
  afterEach(() => vi.unstubAllGlobals());
  test('resumes sound that iOS interrupted', () => {
    const resume = vi.fn(() => Promise.resolve());
    vi.stubGlobal('AudioContext', class { state = 'interrupted'; resume = resume; });
    unlockAudio();
    expect(resume).toHaveBeenCalled();
  });
});
