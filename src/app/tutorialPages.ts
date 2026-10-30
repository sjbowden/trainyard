import type { Tutorial } from '../data/apk.ts';
import { parseTutorial } from '../data/tutorials.ts';
import { decodeBoard } from '../engine/codec.ts';
import type { Board } from '../engine/types.ts';
import { drawPath, toggleSwitch } from './editing.ts';

export interface TutorialPage { title: string; boxes: string[]; board: Board | null }

/**
 * One page per tutorial step with text. Each page's board is the step's board after the
 * tutorial hand's strokes and taps, so the track drawn so far is shown.
 */
export function tutorialPages(tutorials: Pick<Tutorial, 'name' | 'xml'>[]): TutorialPage[] {
  const pages: TutorialPage[] = [];
  for (const t of tutorials) {
    let board: Board | null = null;
    for (const step of parseTutorial(t.xml)) {
      if (step.board) {
        try {
          board = decodeBoard(step.board);
        } catch {
          board = null;
        }
      }
      for (const a of step.actions ?? []) {
        if (!board) break;
        const b: Board = board;
        const index = ([c, r]: [number, number]) => r * b.cols + c;
        board = a.kind === 'stroke' ? drawPath(b, a.cells.map(index)) : toggleSwitch(b, index(a.cell));
      }
      if (step.boxes.length) pages.push({ title: t.name, boxes: step.boxes, board });
    }
  }
  return pages;
}
