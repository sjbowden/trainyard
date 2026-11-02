import { expect, test } from 'vitest';
import { strToU8, deflateSync } from 'fflate';
import { deliveredColors, Player } from '../../src/app/board/player.ts';
import { decodeShare, encodeShare, LinkError } from '../../src/app/share.ts';
import { isSafeToUpdate } from '../../src/app/updates.ts';
import { buildRoute, type Route } from '../../src/app/router.ts';
import { COLOR, SIDE } from '../../src/engine/types.ts';
import { board, goal, outlet } from '../engine/helpers.ts';

test('no update reloads a screen where a puzzle is being played, tested, edited or generated', () => {
  const busy: Route[] = [
    { name: 'puzzle', collection: 'trainyard', slug: 'redLine' },
    { name: 'play', id: 'm-1' },
    { name: 'shared', payload: 'x' },
    { name: 'edit', id: 'm-1' },
    { name: 'new' },
    { name: 'libraryPuzzle', group: 'w-0', id: '42' },
  ] as Route[];
  for (const r of busy) expect(isSafeToUpdate(buildRoute(r)), r.name).toBe(false);
  expect(isSafeToUpdate(buildRoute({ name: 'library' }))).toBe(true);
});

test('two trains of different colors reaching one goal together each report their own color', () => {
  const b = board({ '2,3': outlet(SIDE.R, COLOR.red), '3,3': goal([SIDE.L, SIDE.R], COLOR.red, COLOR.blue), '4,3': outlet(SIDE.L, COLOR.blue) });
  const colors: number[] = [];
  const p = new Player(b, (ev) => colors.push(...deliveredColors(p.run, ev.delivered)));
  for (let i = 0; i < 20 && !p.finished; i++) p.advance(0.5, 1);
  expect(colors.sort()).toEqual([COLOR.red, COLOR.blue].sort());
});

// A link with a correct checksum whose body inflates to far more than any puzzle needs.
const checksum = (text: string) => {
  let h = 0x811c9dc5;
  for (const byte of strToU8(text)) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('an oversized share link is refused before it is unpacked', () => {
  const good = encodeShare({ name: 'Red line', code: 'hh002Oja3Giaa00' });
  const version = good.split('.')[0];
  const body = `${version}.${b64(deflateSync(strToU8(JSON.stringify({ n: 'x'.repeat(2_000_000), c: 'hh002Oja3Giaa00' }))))}`;
  expect(() => decodeShare(`${body}.${checksum(body)}`)).toThrow(LinkError);
  expect(decodeShare(good).name).toBe('Red line');
});
