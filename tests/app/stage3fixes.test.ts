import { expect, test, vi } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { withoutLevel } from '../../src/app/progress.ts';
import { DebouncedSave } from '../../src/app/saver.ts';
import { decodeShare, encodeShare } from '../../src/app/share.ts';
import { checkNotOriginal, parsePastedLink } from '../../src/app/sharedLinks.ts';
import { isSafeToUpdate } from '../../src/app/updates.ts';

test('a cancelled save never runs', () => {
  vi.useFakeTimers();
  const saved: string[] = [];
  const s = new DebouncedSave<string>((v) => saved.push(v), 400);
  s.schedule('edit');
  s.cancel();
  vi.advanceTimersByTime(1000);
  s.flush();
  expect(saved).toEqual([]);
  vi.useRealTimers();
});

test('forgetting a level removes it from in-memory progress', () => {
  const p = { levels: { 'custom/m-1': { solved: true, solution: 'x' }, 'trainyard/redLine': { solved: true, solution: 'y' } } };
  expect(withoutLevel(p, 'custom/m-1')).toEqual({ levels: { 'trainyard/redLine': { solved: true, solution: 'y' } } });
});

test('updates wait while any puzzle is being played or edited', () => {
  for (const hash of ['#/p/trainyard/redLine', '#/play/m-1', '#/s/1.a.0123abcd', '#/edit/m-1']) expect(isSafeToUpdate(hash), hash).toBe(false);
  for (const hash of ['#/', '#/mine', '#/c/trainyard', '#/settings']) expect(isSafeToUpdate(hash), hash).toBe(true);
});

test('a pasted link may end with punctuation or brackets', () => {
  const payload = encodeShare({ name: 'Gift', code: 'hh002OjC3GiaC00' });
  for (const text of [`Try this: https://x/trainyard/#/s/${payload}.`, `<https://x/trainyard/#/s/${payload}>`, `(https://x/trainyard/#/s/${payload}),`]) {
    expect(parsePastedLink(text).code).toBe('hh002OjC3GiaC00');
  }
});

test('an original puzzle is refused even when its code is spelled differently', () => {
  const collections = [{ id: 'trainyard', worlds: [], tutorials: [], levels: [{ slug: 'r', worldSlug: 'w', name: 'R', stars: 1, code: 'hh002Oja3Giaa00', ordinal: 1 }] }] as Collection[];
  // '12' covers the same three cells as '3'
  expect(() => checkNotOriginal({ name: 'x', code: 'hh002Oja12Giaa00' }, collections)).toThrow("That's one of the original puzzles.");
});

test('a future link format asks for a newer app even if it looks different', () => {
  expect(() => decodeShare('2.something.else.entirely')).toThrow('This puzzle link needs a newer version of the app.');
});
