import { expect, test } from 'vitest';
import { decodeBoard } from '../../src/engine/codec.ts';
import { simulate } from '../../src/engine/sim.ts';
import { generate } from '../../src/solver/generate.ts';

test('generate returns a playable puzzle within its deadline', () => {
  const start = performance.now();
  const g = generate('easy', { seed: 1, deadline: start + 3000 });
  expect(performance.now() - start).toBeLessThan(3500);
  expect(simulate(decodeBoard(`${g.code}_${g.proof}`)).outcome).toBe('won');
  expect(g.easierThanAsked ? true : g.difficulty === 'easy').toBe(true);
});

test('the same seed gives the same generated puzzle', () => {
  const far = performance.now() + 20_000;
  expect(generate('medium', { seed: 5, deadline: far }).code).toBe(generate('medium', { seed: 5, deadline: far }).code);
});

test('generate stops soon after its deadline even if nothing fits', () => {
  const start = performance.now();
  const g = generate('veryHard', { seed: 3, deadline: start + 500 });
  expect(performance.now() - start).toBeLessThan(5000);
  expect(g.code).toMatch(/^hh/);
});
