/** The original tutorials' XML scripts, reduced to what the app shows: text and boards. */

export interface TutorialStep {
  /** The text boxes shown in this step, with `[br]` turned into line breaks. */
  boxes: string[];
  /** The puzzle code the board resets to in this step, if it changes. */
  board?: string;
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
    return board ? { boxes, board } : { boxes };
  });
}
