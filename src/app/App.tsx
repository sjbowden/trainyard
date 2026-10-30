import { useEffect, useState } from 'preact/hooks';
import type { Level } from '../data/apk.ts';
import { PuzzleScreen } from './screens/PuzzleScreen.tsx';

/** Dev only: ?dev=<slug> opens that original puzzle from local/collections.json. */
function DevPuzzle({ slug }: { slug: string }) {
  const [level, setLevel] = useState<Level | null>(null);
  useEffect(() => {
    fetch('__dev/collections.json')
      .then((r) => r.json())
      .then((cs: { levels: Level[] }[]) => setLevel(cs.flatMap((c) => c.levels).find((l) => l.slug === slug) ?? null));
  }, [slug]);
  if (!level) return <main class="screen">Loading {slug}…</main>;
  return <PuzzleScreen title={level.name} stars={level.stars} puzzleCode={level.code} savedSolution="" onResult={() => {}} onBack={() => {}} />;
}

export function App() {
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('dev') : null;
  if (dev) return <DevPuzzle slug={dev} />;
  return (
    <main class="screen">
      <h1>Trainyard</h1>
    </main>
  );
}
