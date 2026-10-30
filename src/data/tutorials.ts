/** The original tutorials' XML scripts, reduced to what the app shows: text and boards. */

export type Cell = [col: number, row: number];

/** What the tutorial's hand does to the board: draw through cells, or tap a switch. */
export type HandAction = { kind: 'stroke'; cells: Cell[] } | { kind: 'tap'; cell: Cell };

export interface TutorialStep {
  /** The text boxes shown in this step, with `[br]` turned into line breaks. */
  boxes: string[];
  /** The puzzle code the board resets to in this step, if it changes. */
  board?: string;
  /** The hand's strokes and taps in this step, in order (absent when there are none). */
  actions?: HandAction[];
}

/** The original's tutorials describe a few iPhone controls this app does differently. */
const REWRITES: [RegExp, string][] = [
  [/SHAKE to erase all tracks/, 'tap CLEAR to erase all tracks'],
  [/with a simple DOUBLE TAP/, 'with a simple TAP'],
];

const rewrite = (text: string) => REWRITES.reduce((t, [from, to]) => t.replace(from, to), text);

export function parseTutorial(xml: string): TutorialStep[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  return Array.from(doc.getElementsByTagName('step')).map((step) => {
    const boxes = Array.from(step.getElementsByTagName('create_box')).map((b) => rewrite((b.textContent ?? '').replaceAll('[br]', '\n').trim()));
    const board = step.getElementsByTagName('yard_reset')[0]?.getAttribute('full') ?? undefined;
    const actions = handActions(step);
    return { boxes, ...(board ? { board } : {}), ...(actions.length ? { actions } : {}) };
  });
}

function parseCell(el: Element): Cell | null {
  const m = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(el.getAttribute('cr') ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Follows the hand: a stroke runs from finger down to finger up; a double tap taps where the hand is. */
function handActions(step: Element): HandAction[] {
  const actions: HandAction[] = [];
  let at: Cell | null = null;
  let stroke: Cell[] | null = null;
  for (const el of Array.from(step.children)) {
    switch (el.tagName) {
      case 'hand_enterTo':
      case 'hand_moveTo': {
        const cell = parseCell(el);
        if (!cell) break;
        at = cell;
        stroke?.push(cell);
        break;
      }
      case 'hand_fingerDown':
        if (at) stroke = [at];
        break;
      case 'hand_fingerUp':
        if (stroke && stroke.length > 1) actions.push({ kind: 'stroke', cells: stroke });
        stroke = null;
        break;
      case 'hand_fingerDoubleTap':
        if (at) actions.push({ kind: 'tap', cell: at });
        break;
    }
  }
  return actions;
}

