import { useEffect, useState } from 'preact/hooks';
import type { Collection, Level } from '../data/apk.ts';
import { emptyProgress, levelKey, recordAttempt, type Progress } from './progress.ts';
import { buildRoute, parseRoute, type Route } from './router.ts';
import { CityScreen } from './screens/CityScreen.tsx';
import { CollectionScreen } from './screens/CollectionScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LoadApkScreen } from './screens/LoadApkScreen.tsx';
import { PuzzleScreen } from './screens/PuzzleScreen.tsx';
import { loadCollections, loadProgress, saveProgress } from './store.ts';

const go = (r: Route) => {
  location.hash = buildRoute(r);
};

/** The level after this one in its city, or the first of the next city. */
function nextLevel(c: Collection, level: Level): Level | undefined {
  const order = c.worlds.flatMap((w) => c.levels.filter((l) => l.worldSlug === w.slug).sort((a, b) => a.ordinal - b.ordinal));
  return order[order.indexOf(level) + 1];
}

/** Dev only: ?dev=<slug> opens that original puzzle from local/collections.json. */
function DevPuzzle({ slug }: { slug: string }) {
  const [level, setLevel] = useState<Level | null>(null);
  useEffect(() => {
    fetch('__dev/collections.json')
      .then((r) => r.json())
      .then((cs: Collection[]) => setLevel(cs.flatMap((c) => c.levels).find((l) => l.slug === slug) ?? null));
  }, [slug]);
  if (!level) return <main class="screen">Loading {slug}…</main>;
  return <PuzzleScreen title={level.name} stars={level.stars} puzzleCode={level.code} savedSolution="" onResult={() => {}} onBack={() => {}} />;
}

export function App() {
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('dev') : null;
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [collections, setCollections] = useState<Collection[] | null | undefined>(undefined);
  const [progress, setProgress] = useState<Progress>(emptyProgress);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', onHash);
    void Promise.all([loadCollections(), loadProgress()]).then(([c, p]) => {
      setCollections(c);
      setProgress(p);
    });
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (dev) return <DevPuzzle slug={dev} />;
  if (collections === undefined) return <main class="screen" />;

  const record = (key: string, solution: string, solved: boolean) => {
    setProgress((p) => {
      const next = recordAttempt(p, key, solution, solved);
      void saveProgress(next);
      return next;
    });
  };

  const collection = 'collection' in route ? collections?.find((c) => c.id === route.collection) : undefined;

  switch (route.name) {
    case 'load':
      return (
        <LoadApkScreen
          onLoaded={(c) => {
            setCollections(c);
            go({ name: 'home' });
          }}
        />
      );
    case 'collection':
      if (collection) return <CollectionScreen collection={collection} progress={progress} />;
      break;
    case 'city':
      if (collection) return <CityScreen collection={collection} world={route.world} progress={progress} />;
      break;
    case 'puzzle': {
      const level = collection?.levels.find((l) => l.slug === route.slug);
      if (collection && level) {
        const key = levelKey(collection.id, level.slug);
        const next = nextLevel(collection, level);
        return (
          <PuzzleScreen
            key={key}
            title={level.name}
            stars={level.stars}
            puzzleCode={level.code}
            savedSolution={progress.levels[key]?.solution ?? ''}
            onResult={(solution, solved) => record(key, solution, solved)}
            onBack={() => go({ name: 'city', collection: collection.id, world: level.worldSlug })}
            onNext={next ? () => go({ name: 'puzzle', collection: collection.id, slug: next.slug }) : undefined}
          />
        );
      }
      break;
    }
  }
  return <HomeScreen collections={collections} progress={progress} />;
}
