import { expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { checkNotOriginal, parsePastedLink } from '../../src/app/sharedLinks.ts';
import { encodeShare, LinkError } from '../../src/app/share.ts';

const puzzle = { name: 'Gift', code: 'hh002OjC3GiaC00' };
const payload = encodeShare(puzzle);

test('accepts a full link, a link with spaces around it, or a bare payload', () => {
  expect(parsePastedLink(`https://sjbowden.github.io/trainyard/#/s/${payload}`)).toEqual(puzzle);
  expect(parsePastedLink(`  Try this: https://sjbowden.github.io/trainyard/#/s/${payload}\n`)).toEqual(puzzle);
  expect(parsePastedLink(payload)).toEqual(puzzle);
});

test('rejects anything else with a readable message', () => {
  expect(() => parsePastedLink('')).toThrow("That isn't a puzzle link.");
  expect(() => parsePastedLink('hello')).toThrow(LinkError);
  expect(() => parsePastedLink(`https://sjbowden.github.io/trainyard/#/s/${payload.slice(0, -1)}`)).toThrow('This puzzle link is damaged.');
});

test('refuses the original puzzles', () => {
  const collections = [{ id: 'trainyard', worlds: [], tutorials: [], levels: [{ slug: 'x', worldSlug: 'w', name: 'X', stars: 1, code: 'hh002OjC3GiaC00', ordinal: 1 }] }] as Collection[];
  expect(() => checkNotOriginal(puzzle, collections)).toThrow("That's one of the original puzzles.");
  expect(() => checkNotOriginal({ name: 'y', code: 'hh002Oja3Giaa00' }, collections)).not.toThrow();
  expect(() => checkNotOriginal(puzzle, null)).not.toThrow();
});
