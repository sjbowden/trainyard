import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, describe, expect, test } from 'vitest';
import { parseRoute } from '../../src/app/router.ts';
import { loadProgress, saveProgress } from '../../src/app/store.ts';
import { deliveredColors, Player } from '../../src/app/board/player.ts';
import { decodeBoard } from '../../src/engine/codec.ts';
import { COLOR, SIDE } from '../../src/engine/types.ts';
import { board, goal, outlet } from '../engine/helpers.ts';

test('a malformed link goes home instead of crashing', () => {
  expect(parseRoute('#/p/trainyard/%E0%A4')).toEqual({ name: 'home' });
});

describe('saving', () => {
  beforeEach(() => clear(createStore('trainyard', 'kv')));

  test('overlapping saves both land', async () => {
    await Promise.all([
      saveProgress({ levels: { 'trainyard/a': { solved: true, solution: 'x' } } }),
      saveProgress({ levels: { 'trainyard/b': { solved: false, solution: 'y' } } }),
    ]);
    expect(Object.keys((await loadProgress()).levels).sort()).toEqual(['trainyard/a', 'trainyard/b']);
  });
});

test('deliveries report the delivered trains\' colors', () => {
  const b = board({ '0,3': outlet(SIDE.R, COLOR.blue), '1,3': goal([SIDE.L], COLOR.blue), '0,5': outlet(SIDE.R, COLOR.yellow), '1,5': goal([SIDE.L], COLOR.yellow) });
  const colors: number[] = [];
  const p = new Player(b, (ev) => colors.push(...deliveredColors(p.run, ev.delivered)));
  for (let i = 0; i < 10 && !p.finished; i++) p.advance(0.5, 1);
  expect(colors.sort()).toEqual([COLOR.yellow, COLOR.blue].sort());
  void decodeBoard;
});
