/** The original tutorials' XML scripts, reduced to what the app shows: text and boards. */

export interface TutorialStep {
  /** The text boxes shown in this step, with `[br]` turned into line breaks. */
  boxes: string[];
  /** The puzzle code the board resets to in this step, if it changes. */
  board?: string;
}

export function parseTutorial(xml: string): TutorialStep[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  return Array.from(doc.getElementsByTagName('step')).map((step) => {
    const boxes = Array.from(step.getElementsByTagName('create_box')).map((b) => (b.textContent ?? '').replaceAll('[br]', '\n').trim());
    const board = step.getElementsByTagName('yard_reset')[0]?.getAttribute('full') ?? undefined;
    return board ? { boxes, board } : { boxes };
  });
}
