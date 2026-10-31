import { expect, test } from 'vitest';
import { isSafeToUpdate } from '../../src/app/updates.ts';
import { ASK_MAX_NODES } from '../../src/app/solverClient.ts';
import { generateCandidate } from '../../src/solver/generate.ts';

test('an update waits while a puzzle is being generated', () => {
  expect(isSafeToUpdate('#/new')).toBe(false);
});

test("Ask the solver's node budget stays within a phone's memory", () => {
  expect(ASK_MAX_NODES).toBeLessThanOrEqual(500_000);
});

test('generated puzzles can need brown trains', () => {
  const needsBrown = Array.from({ length: 300 }, (_, s) => generateCandidate(s, 'veryHard')).some((c) => c && /G../.test(c.code) && decodeNeedsBrown(c.code));
  expect(needsBrown).toBe(true);
});

import { decodeBoard } from '../../src/engine/codec.ts';
function decodeNeedsBrown(code: string): boolean {
  return decodeBoard(code).cells.some((p) => p.kind === 'goal' && p.colors.includes(6));
}
