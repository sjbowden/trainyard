import { describe, expect, test } from 'vitest';
import { decodeBoard } from '../../src/engine/codec.ts';
import { createRun, simulate, trackCount } from '../../src/engine/sim.ts';
import { COLOR, SEGMENT, SIDE } from '../../src/engine/types.ts';
import { at, board, dummyGoal, goal, outlet, painter, rock, splitter, track } from './helpers.ts';

const { T, R, B, L } = SIDE;
const { red, yellow, blue, orange, green, purple } = COLOR;
const { TR, TL, TB, LR } = SEGMENT;

function stepTo(b: ReturnType<typeof board>, halfSteps: number) {
  const run = createRun(b);
  for (let i = 0; i < halfSteps; i++) run.halfStep();
  return run;
}

describe('simulate', () => {
  test('straight line delivers', () => {
    // steps is a hypothesis confirmed against trainyard.ca fixtures in tests/accuracy.test.ts
    expect(simulate(decodeBoard('hh002Oja3Giaa00_003QQQ00'))).toMatchObject({ outcome: 'won', steps: 4 });
  });

  test('mixes colors on merge', () => {
    const b = board({ '0,3': outlet(R, red), '1,3': track(LR), '2,1': outlet(B, blue), '2,2': track(TB), '2,3': track(LR, TR), '3,3': goal([L], purple) });
    expect(simulate(b).outcome).toBe('won');
  });

  test('head-on swap mixes both', () => {
    const run = stepTo(board({ '0,3': outlet(R, red), '1,3': track(LR), '2,3': track(LR), '3,3': outlet(L, blue), ...dummyGoal }), 4);
    expect(run.trains.filter((t) => t.alive).map((t) => t.color)).toEqual([purple, purple]);
  });

  test('crossing mixes when both are on the cross together', () => {
    const run = stepTo(board({ '2,3': outlet(R, red), '3,2': outlet(B, blue), '3,3': track(LR, TB), ...dummyGoal }), 3);
    expect(run.trains.map((t) => t.color)).toEqual([purple, purple]);
  });

  test('crossing does not mix trains that pass at different times', () => {
    const b = board({ '2,3': outlet(R, red), '3,1': outlet(B, blue), '3,2': track(TB), '3,3': track(LR, TB), '4,3': track(LR), '5,3': track(LR), '3,4': track(TB), '3,5': track(TB), ...dummyGoal });
    const run = stepTo(b, 5);
    // trains are created in cell order, so blue (row 1) precedes red (row 3)
    expect(run.trains.filter((t) => t.alive).map((t) => t.color)).toEqual([blue, red]);
  });

  test('painter recolors', () => {
    const b = board({ '0,3': outlet(R, red), '1,3': painter(blue, L, R), '2,3': track(LR), '3,3': goal([L], blue) });
    expect(simulate(b).outcome).toBe('won');
  });

  test('splitter splits secondaries into primaries in order', () => {
    const run = stepTo(board({ '3,0': outlet(B, orange), '3,1': splitter(T), ...dummyGoal }), 3);
    const bySide = Object.fromEntries(run.trains.filter((t) => t.alive).map((t) => [t.nextSide, t.color]));
    expect(bySide).toEqual({ [R]: yellow, [L]: red });
  });

  test('splitter duplicates primaries', () => {
    const run = stepTo(board({ '3,0': outlet(B, blue), '3,1': splitter(T), ...dummyGoal }), 3);
    expect(run.trains.filter((t) => t.alive).map((t) => t.color)).toEqual([blue, blue]);
  });

  test('splitter entered from the wrong side crashes', () => {
    expect(simulate(board({ '2,1': outlet(R, red), '3,1': splitter(T), ...dummyGoal })).outcome).toBe('crashed');
  });

  test('switch toggles after a train passes', () => {
    const b = board({ '3,0': outlet(B, red, red), '3,1': track(TR, TL), '4,1': goal([L], red), '2,1': goal([R], red) });
    expect(simulate(b).outcome).toBe('won');
  });

  test('switch toggles once per train in the same half-step', () => {
    const b = board({ '2,3': outlet(R, red), '3,2': outlet(B, blue), '3,3': track(LR, TR), ...dummyGoal });
    const run = stepTo(b, 4);
    expect(run.board.cells[at(3, 3)]).toEqual(track(LR, TR));
  });

  test('a track cell holding only a secondary segment carries trains and never switches', () => {
    const b = board({ '0,3': outlet(R, red), '1,3': track(0, LR), '2,3': goal([L], red) });
    expect(simulate(b).outcome).toBe('won');
  });

  test('wrong color into a goal crashes', () => {
    expect(simulate(board({ '0,3': outlet(R, red), '1,3': goal([L], blue) })).outcome).toBe('crashed');
  });

  test('surplus color into a goal crashes', () => {
    expect(simulate(board({ '0,3': outlet(R, red, red, blue), '1,3': goal([L], red, blue) })).outcome).toBe('crashed');
  });

  test('wins with trains still in an outlet', () => {
    // three trains, so the outlet still holds one when the first is delivered
    expect(simulate(board({ '0,3': outlet(R, red, red, red), '1,3': goal([L], red) })).outcome).toBe('won');
  });

  describe('leaving the board crashes', () => {
    test.each([
      ['right', { '5,2': outlet(R, red), '6,2': track(LR) }],
      ['left', { '1,2': outlet(L, red), '0,2': track(LR) }],
      ['top', { '2,1': outlet(T, red), '2,0': track(TB) }],
      ['bottom', { '2,5': outlet(B, red), '2,6': track(TB) }],
      ['straight out of an edge outlet', { '6,2': outlet(R, red) }],
    ])('%s', (_name, spec) => {
      expect(simulate(board({ ...spec, '0,6': goal([T], green) })).outcome).toBe('crashed');
    });

    test('never wraps onto the next row', () => {
      const run = createRun(board({ '5,2': outlet(R, red), '6,2': track(LR), '0,3': track(LR), '0,6': goal([T], green) }));
      for (let i = 0; i < 10; i++) {
        run.halfStep();
        expect(run.trains.some((t) => t.alive && t.cell === at(0, 3))).toBe(false);
      }
      expect(run.outcome).toBe('crashed');
    });
  });

  test.each([
    ['an empty cell', {}],
    ['a rock', { '1,0': rock }],
    ['an outlet', { '1,0': outlet(B, red) }],
  ])('entering %s crashes', (_name, spec) => {
    expect(simulate(board({ '0,0': outlet(R, red), ...spec, ...dummyGoal })).outcome).toBe('crashed');
  });

  test('stalls when nothing can move', () => {
    expect(simulate(board({ '0,3': outlet(R, red), '1,3': goal([L], red, blue) })).outcome).toBe('stalled');
  });
});

test('trackCount counts a cell whose only segment is its secondary as both', () => {
  // trainyard.ca "youDid" solution 7FGz: 25 single cells plus one such cell → 26001
  expect(trackCount(board({ '0,0': track(LR), '1,0': track(0, LR) }))).toEqual({ major: 2, minor: 1 });
});

test('trackCount counts primaries and secondaries', () => {
  expect(trackCount(board({ '0,0': track(LR), '1,0': track(TB), '2,0': track(LR, TB) }))).toEqual({ major: 3, minor: 1 });
});

describe('run lifecycle', () => {
  test('ended is false while running and true after a win', () => {
    const run = createRun(decodeBoard('hh002Oja3Giaa00_003QQQ00'));
    run.halfStep();
    expect(run.ended).toBe(false);
    while (!run.ended) run.halfStep();
    expect(run.outcome).toBe('won');
  });

  test('a crashed run keeps stepping until it ends', () => {
    // the second outlet's train crashes at once; the first keeps going and is delivered later
    const run = createRun(board({ '0,3': outlet(R, red), '1,3': track(LR), '2,3': track(LR), '3,3': goal([L], red, blue), '6,0': outlet(R, blue) }));
    run.halfStep();
    run.halfStep();
    expect(run.outcome).toBe('crashed');
    expect(run.ended).toBe(false);
    while (!run.ended) run.halfStep();
    expect(run.outcome).toBe('crashed');
  });

  test('simulate reports timeout for a looping run', () => {
    // enters the 2x2 square at (2,2) and circles it forever
    const loop = board({ '1,2': outlet(R, red), '2,2': track(LR, SEGMENT.BR), '3,2': track(SEGMENT.BL), '3,3': track(TL), '2,3': track(TR), ...dummyGoal });
    expect(simulate(loop, 50).outcome).toBe('timeout');
  });

  test('trainsBefore holds each train\'s previous cell', () => {
    const run = createRun(decodeBoard('hh002Oja3Giaa00_003QQQ00'));
    run.halfStep(); // spawn at 22
    run.halfStep(); // move to 23
    expect(run.trainsBefore.map((t) => t.cell)).toEqual([22]);
    expect(run.trains.map((t) => t.cell)).toEqual([23]);
  });
});

test('trains record the side they entered their cell by', () => {
  const run = createRun(decodeBoard('hh002Oja3Giaa00_003QQQ00'));
  run.halfStep(); // spawned on the outlet, heading right: entered "from" the left
  expect(run.trains[0]).toMatchObject({ cell: 22, entry: L, nextSide: R });
  run.halfStep(); // moved into 23 through its left side
  expect(run.trains[0]).toMatchObject({ cell: 23, entry: L, nextSide: R });
  const corner = createRun(board({ '0,3': outlet(R, red), '1,3': track(TL), ...dummyGoal }));
  corner.halfStep();
  corner.halfStep();
  expect(corner.trains[0]).toMatchObject({ cell: at(1, 3), entry: L, nextSide: T });
});

