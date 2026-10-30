import { expect, test, vi } from 'vitest';
import { Updater } from '../../src/app/updates.ts';

test('an update found on a safe screen applies at once', () => {
  const apply = vi.fn();
  const u = new Updater(apply, () => true);
  u.updateFound();
  expect(apply).toHaveBeenCalledOnce();
});

test('an update found mid-puzzle waits until the player leaves the puzzle', () => {
  const apply = vi.fn();
  let safe = false;
  const u = new Updater(apply, () => safe);
  u.updateFound();
  u.navigated();
  expect(apply).not.toHaveBeenCalled();
  safe = true;
  u.navigated();
  expect(apply).toHaveBeenCalledOnce();
  u.navigated();
  expect(apply).toHaveBeenCalledOnce();
});
