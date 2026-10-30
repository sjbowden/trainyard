import { useMemo, useState } from 'preact/hooks';
import type { Tutorial } from '../../data/apk.ts';
import { parseTutorial } from '../../data/tutorials.ts';
import { decodeBoard } from '../../engine/codec.ts';
import type { Board } from '../../engine/types.ts';
import { BoardPreview } from '../board/BoardPreview.tsx';
import type { Theme } from '../theme/theme.ts';

interface Page { title: string; boxes: string[]; board: Board | null }

/** Steps through a city's tutorials: each step's text over its board. */
export function TutorialOverlay({ tutorials, theme, onClose }: { tutorials: Tutorial[]; theme: Theme; onClose: () => void }) {
  const pages = useMemo(() => {
    const out: Page[] = [];
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
        if (step.boxes.length) out.push({ title: t.name, boxes: step.boxes, board });
      }
    }
    return out;
  }, [tutorials]);
  const [i, setI] = useState(0);
  const page = pages[i];
  if (!page) return null;
  const last = i === pages.length - 1;

  return (
    <div class="tutorial" role="dialog" aria-label="How to play">
      <div class="card">
        <header class="bar">
          <h2>{page.title}</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </header>
        {page.board && <BoardPreview board={page.board} theme={theme} />}
        {page.boxes.map((b) => (
          <p class="box" key={b}>{b}</p>
        ))}
        <div class="row">
          <button disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <span class="count">{i + 1} / {pages.length}</span>
          <button class="primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
