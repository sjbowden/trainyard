import { useEffect, useRef, useState } from 'preact/hooks';
import type { Collection, Level } from '../data/apk.ts';
import { firstOfCity, nextLevel } from './levels.ts';
import { loadSettings } from './settings.ts';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { markTutorialSeen, tutorialSeen } from './tutorialsSeen.ts';
import { emptyProgress, isWorldUnlocked, levelKey, recordAttempt, type Progress } from './progress.ts';
import { buildRoute, parseRoute, type Route } from './router.ts';
import { CityScreen } from './screens/CityScreen.tsx';
import { CollectionScreen } from './screens/CollectionScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LoadApkScreen } from './screens/LoadApkScreen.tsx';
import { PuzzleScreen } from './screens/PuzzleScreen.tsx';
import { TutorialOverlay } from './screens/TutorialOverlay.tsx';
import { defaultTheme } from './theme/default.ts';
import { loadCollections, loadProgress, saveProgress } from './store.ts';

/** A puzzle, with its city's tutorial the first time the city's first puzzle is opened. */
function Puzzle({ collection, level, progress, onResult, onNext }: { collection: Collection; level: Level; progress: Progress; onResult: (solution: string, solved: boolean) => void; onNext?: () => void }) {
  const id = `${collection.id}/${level.worldSlug}`;
  const tutorials = collection.tutorials.filter((t) => t.worldSlug === level.worldSlug).sort((a, b) => a.ordinal - b.ordinal);
  const [tutorial, setTutorial] = useState(() => tutorials.length > 0 && firstOfCity(collection, level.slug) && !tutorialSeen(id));
  const key = levelKey(collection.id, level.slug);
  return (
    <>
      <PuzzleScreen
        title={level.name}
        stars={level.stars}
        puzzleCode={level.code}
        savedSolution={progress.levels[key]?.solution ?? ''}
        showSolvedCard={loadSettings().showSolvedCard}
        onResult={onResult}
        onBack={back}
        onNext={onNext}
      />
      {tutorial && (
        <TutorialOverlay
          tutorials={tutorials}
          theme={defaultTheme}
          onClose={() => {
            markTutorialSeen(id);
            setTutorial(false);
          }}
        />
      )}
    </>
  );
}

/** Back to wherever the player came from (the home screen if the app opened on this page). */
function back() {
  if (history.length > 1) history.back();
  else go({ name: 'home' });
}

function City({ collection, world, progress }: { collection: Collection; world: string; progress: Progress }) {
  const id = `${collection.id}/${world}`;
  const tutorials = collection.tutorials.filter((t) => t.worldSlug === world).sort((a, b) => a.ordinal - b.ordinal);
  const [open, setOpen] = useState(() => tutorials.length > 0 && !tutorialSeen(id));
  const close = () => {
    markTutorialSeen(id);
    setOpen(false);
  };
  return (
    <>
      <CityScreen collection={collection} world={world} progress={progress} onTutorial={tutorials.length ? () => setOpen(true) : undefined} />
      {open && <TutorialOverlay tutorials={tutorials} theme={defaultTheme} onClose={close} />}
    </>
  );
}

const go = (r: Route) => {
  location.hash = buildRoute(r);
};

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
  const latest = useRef(progress);
  latest.current = progress;
  const [notice, setNotice] = useState<string | undefined>(undefined);

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
    const next = recordAttempt(latest.current, key, solution, solved);
    latest.current = next;
    setProgress(next);
    void saveProgress(next);
  };

  const collection = 'collection' in route ? collections?.find((c) => c.id === route.collection) : undefined;

  switch (route.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'load':
      return (
        <LoadApkScreen
          onLoaded={(c, saved) => {
            setCollections(c);
            setNotice(saved ? undefined : "This phone wouldn't save the puzzles, so you'll need to load the APK again next time.");
            go({ name: 'home' });
          }}
        />
      );
    case 'collection':
      if (collection) return <CollectionScreen collection={collection} progress={progress} />;
      break;
    case 'city':
      if (collection && isWorldUnlocked(collection, route.world, progress)) return <City key={route.world} collection={collection} world={route.world} progress={progress} />;
      break;
    case 'puzzle': {
      const level = collection?.levels.find((l) => l.slug === route.slug);
      if (collection && level && isWorldUnlocked(collection, level.worldSlug, progress)) {
        const key = levelKey(collection.id, level.slug);
        const next = nextLevel(collection, level.slug, progress);
        return (
          <Puzzle
            key={key}
            collection={collection}
            level={level}
            progress={progress}
            onResult={(solution, solved) => record(key, solution, solved)}
            onNext={next ? () => go({ name: 'puzzle', collection: collection.id, slug: next.slug }) : undefined}
          />
        );
      }
      break;
    }
  }
  return <HomeScreen collections={collections} progress={progress} notice={notice} />;
}
