import { expect, test } from 'vitest';
import { MAX_HALF_STEPS, Player, PuzzleController } from '../../src/app/board/player.ts';
import { decodeBoard } from '../../src/engine/codec.ts';
import { SEGMENT, SIDE } from '../../src/engine/types.ts';
import { at, board, dummyGoal, outlet, track } from '../engine/helpers.ts';

const RED_LINE = 'hh002Oja3Giaa00';
const { R } = SIDE;
const { LR, BR, BL, TL, TR } = SEGMENT;
const loop = () => board({ '1,2': outlet(R, 0), '2,2': track(LR, BR), '3,2': track(BL), '3,3': track(TL), '2,3': track(TR), ...dummyGoal });

test('advance steps the run at two half-steps per second at speed 1', () => {
  const p = new Player(decodeBoard(RED_LINE + '_003QQQ00'), () => {});
  p.advance(0, 1); // the first half-step happens at once, as in the original
  expect(p.run.halfSteps).toBe(1);
  p.advance(1, 1);
  expect(p.run.halfSteps).toBe(3);
  p.advance(0.5, 2);
  expect(p.run.halfSteps).toBe(5);
});

test('progress runs from 0 after a move to 0.5 after a center step', () => {
  const p = new Player(decodeBoard(RED_LINE + '_003QQQ00'), () => {});
  p.advance(0, 1); // A: trains appear at the center of their outlet
  expect(p.progress).toBeCloseTo(0.5);
  p.advance(0.25, 1);
  expect(p.progress).toBeCloseTo(0.75);
  p.advance(0.25, 1); // B: moved into the next cell
  expect(p.progress).toBeCloseTo(0);
});

test("Red Line's solution finishes won", () => {
  const events: string[] = [];
  const p = new Player(decodeBoard(RED_LINE + '_003QQQ00'), (ev) => ev.delivered.length && events.push('delivered'));
  for (let i = 0; i < 20 && !p.finished; i++) p.advance(0.5, 1);
  expect(p.finished).toBe('won');
  expect(events).toEqual(['delivered']);
});

test('runs stop at the cap', () => {
  // a run that is still making progress when it reaches the cap
  const p = new Player(decodeBoard(RED_LINE + '_003QQQ00'), () => {}, 3);
  for (let i = 0; i < 20 && !p.finished; i++) p.advance(0.5, 1);
  expect(p.finished).toBe('stopped');
  expect(p.run.halfSteps).toBe(3);
});

test('the default cap is generous', () => {
  expect(MAX_HALF_STEPS).toBe(4000);
});

test('a looping run stops long before the cap', () => {
  const p = new Player(loop(), () => {});
  for (let i = 0; i < 200 && !p.finished; i++) p.advance(100, 1);
  expect(p.finished).toBe('stopped');
  expect(p.run.halfSteps).toBeLessThan(40);
});

test('edits are locked while running', () => {
  const c = new PuzzleController(decodeBoard(RED_LINE), () => {});
  c.draw([at(1, 3), at(2, 3), at(3, 3)]);
  const drawn = c.board;
  c.start();
  c.draw([at(1, 4), at(2, 4), at(3, 4)]);
  c.erase([at(2, 3)]);
  c.tap(at(2, 3));
  c.undo();
  c.clear();
  expect(c.board).toBe(drawn);
  c.stop();
  expect(c.running).toBe(false);
  expect(c.board).toBe(drawn);
  expect(c.board.cells[at(2, 3)]).toEqual(track(LR));
});

test('the controller reports the solution half of the code', () => {
  const c = new PuzzleController(decodeBoard(RED_LINE), () => {});
  expect(c.solution).toBe('');
  c.draw([at(1, 3), at(2, 3), at(3, 3), at(4, 3), at(5, 3)]);
  expect(c.solution).toBe('003QQQ00');
});

test('the controller reports a win once', () => {
  const results: string[] = [];
  const c = new PuzzleController(decodeBoard(RED_LINE + '_003QQQ00'), (f) => results.push(f));
  c.start();
  for (let i = 0; i < 40; i++) c.advance(0.5, 1);
  expect(results).toEqual(['won']);
});
