import { useMemo, useState } from 'preact/hooks';
import type { Tutorial } from '../../data/apk.ts';
import { BoardPreview } from '../board/BoardPreview.tsx';
import type { Theme } from '../theme/theme.ts';
import { tutorialPages } from '../tutorialPages.ts';

/** Steps through a city's tutorials: each step's text over its board. */
export function TutorialOverlay({ tutorials, theme, onClose }: { tutorials: Tutorial[]; theme: Theme; onClose: () => void }) {
  const pages = useMemo(() => tutorialPages(tutorials), [tutorials]);
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
