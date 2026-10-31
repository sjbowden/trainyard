import { useEffect, useRef, useState } from 'preact/hooks';
import type { Difficulty } from '../../solver/difficulty.ts';
import type { Generated } from '../../solver/generate.ts';
import { buildRoute } from '../router.ts';
import { generateInWorker } from '../solverClient.ts';

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', veryHard: 'Very hard' };
const HINTS: Record<Difficulty, string> = {
  easy: 'Simple routes in the primary colors',
  medium: 'Adds mixing colors and painters',
  hard: 'Adds switches, splitters and rocks',
  veryHard: 'Everything at once',
};

/** Pick a difficulty, then build a fresh puzzle in the background. */
export function GenerateScreen({ onReady }: { onReady: (g: Generated) => void }) {
  const [busy, setBusy] = useState<Difficulty | null>(null);
  const [tried, setTried] = useState(0);
  const [failed, setFailed] = useState(false);
  const job = useRef<{ cancel(): void } | null>(null);
  useEffect(() => () => job.current?.cancel(), []); // leaving cancels the work

  const start = (d: Difficulty) => {
    setBusy(d);
    setTried(0);
    setFailed(false);
    const j = generateInWorker(d, setTried);
    job.current = j;
    j.result.then(
      (g) => {
        job.current = null;
        onReady(g);
      },
      () => {
        job.current = null;
        setBusy(null);
        setFailed(true);
      },
    );
  };
  const cancel = () => {
    job.current?.cancel();
    job.current = null;
    setBusy(null);
  };

  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>New puzzle for me</h2>
      </header>
      {busy ? (
        <section class="intro">
          <p>Building a {DIFFICULTY_NAMES[busy].toLowerCase()} puzzle… (tried {tried})</p>
          <button class="wide" onClick={cancel}>Cancel</button>
        </section>
      ) : (
        <nav class="list">
          {failed && <p class="notice">Something went wrong building that puzzle. Try again.</p>}
          {(Object.keys(DIFFICULTY_NAMES) as Difficulty[]).map((d) => (
            <button class="tile difficulty" onClick={() => start(d)} key={d}>
              <span class="name">{DIFFICULTY_NAMES[d]}</span>
              <span class="muted">{HINTS[d]}</span>
            </button>
          ))}
        </nav>
      )}
    </main>
  );
}
