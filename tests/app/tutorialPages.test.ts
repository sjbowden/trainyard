import { expect, test } from 'vitest';
import { tutorialPages } from '../../src/app/tutorialPages.ts';
import { SEGMENT } from '../../src/engine/types.ts';

const xml = `<tutorial name="T">
  <step><yard_reset full="hh002OjC3GiaC00"/><create_box>One</create_box></step>
  <step><create_box>Two</create_box>
    <hand_enterTo cr="1,3"/><hand_fingerDown/><hand_moveTo cr="5,3"/><hand_fingerUp/><hand_leave/>
  </step>
  <step><create_box>Three</create_box></step>
</tutorial>`;

test('each page shows the board with the track drawn so far', () => {
  const pages = tutorialPages([{ name: 'T', xml }]);
  expect(pages.map((p) => p.boxes[0])).toEqual(['One', 'Two', 'Three']);
  const tracks = (i: number) => pages[i]!.board!.cells.filter((c) => c.kind === 'track').length;
  expect(tracks(0)).toBe(0);
  expect(tracks(1)).toBe(3); // the stroke from the outlet to the goal lays (2,3), (3,3), (4,3)
  expect(pages[1]!.board!.cells[3 * 7 + 3]).toEqual({ kind: 'track', primary: SEGMENT.LR, secondary: 0 });
  expect(tracks(2)).toBe(3); // and the track stays for later steps
});
