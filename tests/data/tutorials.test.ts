// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { parseTutorial } from '../../src/data/tutorials.ts';

test('parses steps, boxes and board resets', () => {
  const xml = `<tutorial slug="t" name="T">
    <step><create_box xy="1,2">Hello[br]there</create_box><delay time="2"/><create_box xy="1,2">Second</create_box></step>
    <step><yard_reset full="hh002OjC3GiaC00"/><create_arrow cr="1,3"/><create_box xy="1,2">Look</create_box></step>
  </tutorial>`;
  expect(parseTutorial(xml)).toEqual([
    { boxes: ['Hello\nthere', 'Second'] },
    { boxes: ['Look'], board: 'hh002OjC3GiaC00' },
  ]);
});

test('returns no steps for malformed XML', () => {
  expect(parseTutorial('<tutorial><step>')).toEqual([]);
});

test.skipIf(!existsSync('local/collections.json'))('parses the original welcome tutorial', () => {
  const [trainyard] = JSON.parse(readFileSync('local/collections.json', 'utf8')) as Collection[];
  const steps = parseTutorial(trainyard!.tutorials.find((t) => t.slug === 'welcome')!.xml);
  expect(steps).toHaveLength(5);
  expect(steps[0]!.boxes[0]).toBe('Welcome to TRAINYARD!');
  expect(steps[1]!.board).toBe('hh002OjC3GiaC00');
});
