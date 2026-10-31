import { useEffect, useRef, useState } from 'preact/hooks';
import type { Collection, Level } from '../data/apk.ts';
import { encodeBoard } from '../engine/codec.ts';
import { addShared, customKey, deleteCustomPuzzle, listCustomPuzzles, newPuzzleId, saveCustomPuzzle, type CustomPuzzle } from './customPuzzles.ts';
import { emptyBoard } from './editor.ts';
import { firstOfCity, nextLevel } from './levels.ts';
import { EditorScreen } from './screens/EditorScreen.tsx';
import { MyPuzzlesScreen } from './screens/MyPuzzlesScreen.tsx';
import { DIFFICULTY_NAMES, GenerateScreen } from './screens/GenerateScreen.tsx';
import { sharePuzzle } from './sharing.ts';
import { LinkProblem, SharedScreen } from './screens/SharedScreen.tsx';
import { decodeShare, type SharedPuzzle } from './share.ts';
import { checkNotOriginal, parsePastedLink } from './sharedLinks.ts';
import { loadSettings } from './settings.ts';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { markTutorialSeen, tutorialSeen } from './tutorialsSeen.ts';
import { emptyProgress, isWorldUnlocked, levelKey, recordAttempt, withoutLevel, type Progress } from './progress.ts';
import { buildRoute, parseRoute, puzzleBackRoute, type Route } from './router.ts';
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
        onBack={() => go(puzzleBackRoute(lastList, collection.id, level.worldSlug))}
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

/** The last list screen shown (home, a collection or a city), which decides where a puzzle's Back goes. */
let lastList: Route | null = null;

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
  const [custom, setCustom] = useState<CustomPuzzle[]>([]);
  const [pasteMessage, setPasteMessage] = useState<string | undefined>(undefined);
  const refreshCustom = () => void listCustomPuzzles().then(setCustom);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', onHash);
    void Promise.all([loadCollections(), loadProgress(), listCustomPuzzles()]).then(([c, p, mine]) => {
      setCollections(c);
      setProgress(p);
      setCustom(mine);
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
  if (route.name === 'home' || route.name === 'collection' || route.name === 'city') lastList = route;

  switch (route.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'mine':
      return (
        <MyPuzzlesScreen
          puzzles={custom}
          onNew={() => {
            const p: CustomPuzzle = { id: newPuzzleId(), source: 'mine', name: 'Untitled', code: encodeBoard(emptyBoard(), { solution: false }), proof: null, created: Date.now() };
            setCustom((list) => [p, ...list]);
            void saveCustomPuzzle(p);
            go({ name: 'edit', id: p.id });
          }}
          message={pasteMessage}
          onShare={(p) => void sharePuzzle(p.name, p.code).then((m) => m && setPasteMessage(m))}
          onPaste={async () => {
            try {
              const shared = parsePastedLink(await navigator.clipboard.readText());
              checkNotOriginal(shared, collections);
              const p = await addShared(shared);
              refreshCustom();
              setPasteMessage(`Added “${p.name}”.`);
            } catch (err) {
              setPasteMessage(err instanceof Error && err.name === 'LinkError' ? err.message : "Couldn't read the clipboard. Copy the link again and retry.");
            }
          }}
        />
      );
    case 'shared': {
      let shared: SharedPuzzle;
      try {
        shared = decodeShare(route.payload);
        checkNotOriginal(shared, collections);
      } catch (err) {
        return <LinkProblem message={(err as Error).message} />;
      }
      return (
        <SharedScreen
          puzzle={shared}
          progress={progress}
          onResult={record}
          onAdded={(p) => {
            setCustom((list) => [p, ...list.filter((x) => x.id !== p.id)]);
            location.replace(buildRoute({ name: 'play', id: p.id }));
          }}
        />
      );
    }
    case 'new':
      return (
        <GenerateScreen
          onReady={(g) => {
            const p: CustomPuzzle = {
              id: `g-${g.difficulty}-${g.seed}`,
              source: 'generated',
              name: `${DIFFICULTY_NAMES[g.difficulty]} #${g.seed % 10000}`,
              code: g.code,
              proof: g.proof,
              created: Date.now(),
              ...(g.note ? { note: g.note } : {}),
            };
            setCustom((list) => [p, ...list.filter((x) => x.id !== p.id)]);
            void saveCustomPuzzle(p);
            location.replace(buildRoute({ name: 'play', id: p.id }));
          }}
        />
      );
    case 'edit': {
      const puzzle = custom.find((p) => p.id === route.id && p.source === 'mine');
      if (!puzzle) break;
      return (
        <EditorScreen
          key={puzzle.id}
          puzzle={puzzle}
          onSave={(p) => {
            setCustom((list) => list.map((x) => (x.id === p.id ? p : x)));
            void saveCustomPuzzle(p);
          }}
          onTest={() => go({ name: 'play', id: puzzle.id })}
          onDelete={() => {
            // drop its progress from memory too, or the next save would write it back
            const next = withoutLevel(latest.current, customKey(puzzle.id));
            latest.current = next;
            setProgress(next);
            setCustom((list) => list.filter((x) => x.id !== puzzle.id));
            void deleteCustomPuzzle(puzzle.id).then(() => {
              refreshCustom();
              go({ name: 'mine' });
            });
          }}
        />
      );
    }
    case 'play': {
      const puzzle = custom.find((p) => p.id === route.id);
      if (!puzzle) break;
      const key = customKey(puzzle.id);
      return (
        <PuzzleScreen
          key={key}
          title={puzzle.name}
          stars={0}
          puzzleCode={puzzle.code}
          savedSolution={progress.levels[key]?.solution ?? ''}
          onResult={(solution, solved) => {
            record(key, solution, solved);
            if (solved && puzzle.source === 'mine') {
              const proven = { ...puzzle, proof: solution };
              setCustom((list) => list.map((x) => (x.id === puzzle.id ? proven : x)));
              void saveCustomPuzzle(proven);
            }
          }}
          onBack={() => go(puzzle.source === 'mine' ? { name: 'edit', id: puzzle.id } : { name: 'mine' })}
        >
          {puzzle.note && <p class="notice">{puzzle.note}</p>}
        </PuzzleScreen>
      );
    }
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
