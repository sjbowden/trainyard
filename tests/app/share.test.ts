import { expect, test } from 'vitest';
import { decodeShare, encodeShare, LinkError, shareUrl } from '../../src/app/share.ts';

const RED_LINE = { name: 'Red line', code: 'hh002Oja3Giaa00' };

test('round-trips a puzzle', () => {
  expect(decodeShare(encodeShare(RED_LINE))).toEqual(RED_LINE);
});

test('round-trips emoji and odd characters, and trims names to 40 characters', () => {
  const name = '🚂 Ünïcode "quotes" & <tags> '.repeat(3);
  const back = decodeShare(encodeShare({ name, code: RED_LINE.code }));
  expect([...back.name].length).toBeLessThanOrEqual(40);
  expect(back.name).toBe([...name].slice(0, 40).join('').trim());
});

test('an empty name reads back as Untitled', () => {
  expect(decodeShare(encodeShare({ name: '   ', code: RED_LINE.code })).name).toBe('Untitled');
});

test('the payload is not an original-format code', () => {
  const payload = encodeShare(RED_LINE);
  expect(payload.startsWith('hh')).toBe(false);
  expect(payload).not.toContain(RED_LINE.code);
  expect(payload).toMatch(/^1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
});

test('every one-character change or truncation is detected', () => {
  const payload = encodeShare(RED_LINE);
  for (let i = 0; i < payload.length; i++) {
    const swapped = payload.slice(0, i) + (payload[i] === 'A' ? 'B' : 'A') + payload.slice(i + 1);
    if (swapped !== payload) expect(() => decodeShare(swapped), `change at ${i}`).toThrow(LinkError);
    expect(() => decodeShare(payload.slice(0, i)), `cut at ${i}`).toThrow(LinkError);
  }
});

test('a newer link version asks for a newer app', () => {
  const payload = encodeShare(RED_LINE).replace(/^1\./, '2.');
  expect(() => decodeShare(payload)).toThrow('This puzzle link needs a newer version of the app.');
});

test('rejects codes that are not playable puzzles', () => {
  expect(() => decodeShare(encodeShare({ name: 'x', code: 'hh!' }))).toThrow('This puzzle link is damaged.');
  expect(() => encodeShare({ name: 'x', code: 'hh002Oja3Giaa00_003QQQ00' })).toThrow(LinkError);
});

test('builds a full link', () => {
  expect(shareUrl(RED_LINE, 'https://sjbowden.github.io/trainyard/')).toBe(`https://sjbowden.github.io/trainyard/#/s/${encodeShare(RED_LINE)}`);
});
