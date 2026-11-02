import { useEffect, useRef, useState } from 'preact/hooks';
import type { Collection, Level } from '../data/apk.ts';
import { encodeBoard } from '../engine/codec.ts';
import { addShared, customKey, deleteCustomPuzzle, listCustomPuzzles, newPuzzleId, saveCustomPuzzle, uniqueName, type CustomPuzzle } from './customPuzzles.ts';
import { emptyBoard } from './editor.ts';
import { firstOfCity, nextLevel } from './levels.ts';
import { EditorScreen } from './screens/EditorScreen.tsx';
import { MyPuzzlesScreen } from './screens/MyPuzzlesScreen.tsx';
import { DIFFICULTY_NAMES, GenerateScreen } from './screens/GenerateScreen.tsx';
import { sharePuzzle } from './sharing.ts';
import { LinkProblem, SharedScreen } from './screens/SharedScreen.tsx';
import { decodeShare, type SharedPuzzle } from './share.ts';
import { checkNotOriginal, parsePastedLink } from './sharedLinks.ts';
import { loadSettings, saveSettings } from './settings.ts';
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
import { forgetOriginalTheme, resolveTheme } from './theme/original/index.ts';
import type { LibraryPuzzle } from '../data/library.ts';
import { creditLine, groupLabel, groupSlug, libraryKey, nextPuzzle, parseGroupSlug } from './library.ts';
import { LibraryListScreen } from './screens/LibraryListScreen.tsx';
import { LibraryScreen } from './screens/LibraryScreen.tsx';
import { Arrival } from './screens/Arrival.tsx';
import type { Theme } from './theme/theme.ts';
import { loadCollections, loadLibrary, loadProgress, saveProgress } from './store.ts';

/** A puzzle, with its city's tutorial the first time the city's first puzzle is opened, and a brief "Now in <city>" when Next brought you here from the city before. */
function Puzzle({ collection, level, progress, theme, arrived, onResult, onNext }: { collection: Collection; level: Level; progress: Progress; theme: Theme; arrived: boolean; onResult: (solution: string, solved: boolean) => void; onNext?: () => void }) {
  const id = `${collection.id}/${level.worldSlug}`;
  const tutorials = collection.tutorials.filter((t) => t.worldSlug === level.worldSlug).sort((a, b) => a.ordinal - b.ordinal);
  const [tutorial, setTutorial] = useState(() => tutorials.length > 0 && firstOfCity(collection, level.slug) && !tutorialSeen(id));
  const key = levelKey(collection.id, level.slug);
  const [city] = useState(() => (arrived ? collection.worlds.find((w) => w.slug === level.worldSlug)?.name : undefined));
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
        theme={theme}
        overlay={city && <Arrival city={city} waiting={tutorial} />}
      />
      {tutorial && (
        <TutorialOverlay
          tutorials={tutorials}
          theme={theme}
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
/** The puzzle Next just moved to from the city before, so it can say which city you're now in. */
let arrivedAt: string | undefined;
/** The library puzzle played last, so its list reopens at it. */
let lastLibraryId: string | undefined;
/** The library search as it was left, and whether the puzzle showing was opened from it (so Back returns there). */
let libraryQuery = '';
let openedFromSearch = false;

/** "Now in <group>" for a puzzle Next brought you to from another group. Kept through re-renders of the same puzzle. */
function GroupArrival({ label }: { label?: string }) {
  const [shown] = useState(label);
  return shown ? <Arrival city={shown} waiting={false} /> : null;
}

function City({ collection, world, progress, theme }: { collection: Collection; world: string; progress: Progress; theme: Theme }) {
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
      {open && <TutorialOverlay tutorials={tutorials} theme={theme} onClose={close} />}
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
  const [library, setLibrary] = useState<LibraryPuzzle[] | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | undefined>(undefined);
  const [librarySort, setLibrarySort] = useState(() => loadSettings().librarySort);
  const [hideSolved, setHideSolved] = useState(() => loadSettings().hideSolved);
  const changeHideSolved = (on: boolean) => {
    saveSettings({ ...loadSettings(), hideSolved: on });
    setHideSolved(on);
  };
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [hasOriginal, setHasOriginal] = useState(false);
  /** Shows the chosen board style; Original falls back to the default when its art is missing or unreadable. */
  const themeAsk = useRef(0);
  const applyTheme = (id: 'default' | 'original') => {
    const ask = ++themeAsk.current; // a slow load mustn't override a later choice
    void resolveTheme(id).then(({ theme: t, available }) => {
      if (ask !== themeAsk.current) return;
      setTheme(t ?? defaultTheme);
      setHasOriginal(available);
    });
  };

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', onHash);
    applyTheme(loadSettings().theme);
    void Promise.all([loadCollections(), loadProgress(), listCustomPuzzles(), loadLibrary()]).then(([c, p, mine, lib]) => {
      setCollections(c);
      setProgress(p);
      setCustom(mine);
      setLibrary(lib);
    });
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (dev) return <DevPuzzle slug={dev} />;
  if (collections === undefined) return <main class="screen" />;

  const removeCustom = async (id: string) => {
    // drop its progress from memory too, or the next save would write it back
    const next = withoutLevel(latest.current, customKey(id));
    latest.current = next;
    setProgress(next);
    setCustom((list) => list.filter((x) => x.id !== id));
    await deleteCustomPuzzle(id);
    refreshCustom();
  };

  const record = (key: string, solution: string, solved: boolean) => {
    const next = recordAttempt(latest.current, key, solution, solved);
    latest.current = next;
    setProgress(next);
    void saveProgress(next);
  };

  const libraryHome = (focusId?: string) => (
    <LibraryScreen
      focusId={focusId}
      library={library}
      progress={progress}
      query={libraryQuery}
      onQuery={(q) => {
        libraryQuery = q;
      }}
      hideSolved={hideSolved}
      onHideSolved={changeHideSolved}
      onOpen={() => {
        openedFromSearch = true;
      }}
      onLoaded={(lib, saved) => {
        setLibrary(lib);
        setLibraryNotice(saved ? undefined : "This phone wouldn't save the library, so you'll need to load it again next time.");
      }}
      notice={libraryNotice}
    />
  );

  const collection = 'collection' in route ? collections?.find((c) => c.id === route.collection) : undefined;
  if (route.name === 'home' || route.name === 'collection' || route.name === 'city') lastList = route;

  switch (route.name) {
    case 'settings':
      return (
        <SettingsScreen
          hasOriginal={hasOriginal}
          onTheme={applyTheme}
          progress={progress}
          onProgress={(merged) => {
            latest.current = merged;
            setProgress(merged);
            void saveProgress(merged);
          }}
        />
      );
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
          onDelete={(p) => removeCustom(p.id)}
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
          theme={theme}
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
              name: uniqueName(`${DIFFICULTY_NAMES[g.difficulty]} #${g.seed % 10000}`, custom.filter((x) => x.id !== `g-${g.difficulty}-${g.seed}`).map((x) => x.name)),
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
          theme={theme}
          onSave={(p) => {
            setCustom((list) => list.map((x) => (x.id === p.id ? p : x)));
            void saveCustomPuzzle(p);
          }}
          onTest={() => go({ name: 'play', id: puzzle.id })}
          onDelete={() => void removeCustom(puzzle.id).then(() => go({ name: 'mine' }))}
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
          theme={theme}
        >
          {puzzle.note && <p class="notice">{puzzle.note}</p>}
        </PuzzleScreen>
      );
    }
    case 'library': {
      // back from a search result: the results keep it in view; otherwise leaving a list lets a solved puzzle hide
      const focus = openedFromSearch ? lastLibraryId : undefined;
      lastLibraryId = undefined;
      return libraryHome(focus);
    }
    case 'libraryList': {
      const group = parseGroupSlug(route.group);
      if (!library || !group) return libraryHome();
      openedFromSearch = false;
      return (
        <LibraryListScreen
          library={library}
          group={group}
          progress={progress}
          sort={librarySort}
          focusId={lastLibraryId}
          hideSolved={hideSolved}
          onHideSolved={changeHideSolved}
          onSort={(s) => {
            saveSettings({ ...loadSettings(), librarySort: s });
            setLibrarySort(s);
          }}
        />
      );
    }
    case 'libraryPuzzle': {
      const group = parseGroupSlug(route.group);
      const puzzle = library?.find((p) => p.id === route.id);
      if (!library || !group || !puzzle) return libraryHome(); // an old link, or no library loaded
      const key = libraryKey(puzzle.id);
      const solved = (id: string) => !!progress.levels[libraryKey(id)]?.solved;
      const next = nextPuzzle(library, group, librarySort, puzzle.id, hideSolved ? solved : undefined);
      const arrived = arrivedAt === key;
      if (arrived) arrivedAt = undefined;
      lastLibraryId = puzzle.id;
      return (
        <PuzzleScreen
          key={key}
          title={puzzle.name}
          stars={0}
          puzzleCode={puzzle.code}
          savedSolution={progress.levels[key]?.solution ?? ''}
          onResult={(solution, solved) => record(key, solution, solved)}
          onBack={() => go(openedFromSearch ? { name: 'library' } : { name: 'libraryList', group: route.group })}
          onNext={
            next &&
            (() => {
              const slug = groupSlug(next.group);
              openedFromSearch = false; // Back now goes to the list you're in
              if (slug !== route.group) arrivedAt = libraryKey(next.puzzle.id);
              go({ name: 'libraryPuzzle', group: slug, id: next.puzzle.id });
            })
          }
          showSolvedCard={loadSettings().showSolvedCard}
          theme={theme}
          overlay={<GroupArrival label={arrived ? groupLabel(group) : undefined} />}
        >
          <p class="muted credit">
            {creditLine(puzzle)}
          </p>
        </PuzzleScreen>
      );
    }
    case 'load':
      return (
        <LoadApkScreen
          onLoaded={(c, saved) => {
            setCollections(c);
            forgetOriginalTheme(); // the new APK may bring new art
            applyTheme(loadSettings().theme);
            setNotice(saved ? undefined : "This phone wouldn't save the puzzles, so you'll need to load the APK again next time.");
            go({ name: 'home' });
          }}
        />
      );
    case 'collection':
      if (collection) return <CollectionScreen collection={collection} progress={progress} />;
      break;
    case 'city':
      if (collection && isWorldUnlocked(collection, route.world, progress)) return <City key={route.world} collection={collection} world={route.world} progress={progress} theme={theme} />;
      break;
    case 'puzzle': {
      const level = collection?.levels.find((l) => l.slug === route.slug);
      if (collection && level && isWorldUnlocked(collection, level.worldSlug, progress)) {
        const key = levelKey(collection.id, level.slug);
        const next = nextLevel(collection, level.slug, progress);
        const arrived = arrivedAt === key;
        if (arrived) arrivedAt = undefined; // read once: coming back later from a list says nothing
        return (
          <Puzzle
            key={key}
            collection={collection}
            level={level}
            progress={progress}
            theme={theme}
            arrived={arrived}
            onResult={(solution, solved) => record(key, solution, solved)}
            onNext={
              next
                ? () => {
                    if (next.worldSlug !== level.worldSlug) arrivedAt = levelKey(collection.id, next.slug);
                    go({ name: 'puzzle', collection: collection.id, slug: next.slug });
                  }
                : undefined
            }
          />
        );
      }
      break;
    }
  }
  return <HomeScreen collections={collections} progress={progress} notice={notice} />;
}
