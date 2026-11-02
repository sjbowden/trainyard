import { useState } from 'preact/hooks';
import type { LibraryPuzzle } from '../../data/library.ts';
import { groupSlug, groupSummaries, homeGroup, searchLibrary } from '../library.ts';
import type { Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';
import { importLibrary } from '../store.ts';
import { HideSolved, LibraryRow, visible } from './LibraryListScreen.tsx';

const PAGE = 100;

/** Search results: matching puzzles, each opening in its home group. */
function Results({ library, query, progress, hideSolved, onHideSolved, onOpen }: { library: LibraryPuzzle[]; query: string; progress: Progress; hideSolved: boolean; onHideSolved: (on: boolean) => void; onOpen: () => void }) {
  const list = visible(searchLibrary(library, query), progress, hideSolved);
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <HideSolved on={hideSolved} onChange={onHideSolved} />
      {list.length ? (
        <nav class="list spaced">
          {list.slice(0, shown).map((p) => (
            <LibraryRow key={p.id} p={p} href={buildRoute({ name: 'libraryPuzzle', group: groupSlug(homeGroup(p)), id: p.id })} progress={progress} onClick={onOpen} />
          ))}
        </nav>
      ) : (
        <p class="muted done">No puzzles match.</p>
      )}
      {list.length > shown && <button class="wide spaced" onClick={() => setShown(shown + PAGE)}>Show more</button>}
    </>
  );
}

/** `query` is the search as it was left; `onOpen` is told when a search result is opened. */
export function LibraryScreen({ library, progress, onLoaded, notice, query: initialQuery = '', onQuery = () => {}, hideSolved = false, onHideSolved = () => {}, onOpen = () => {} }: { library: LibraryPuzzle[] | null; progress: Progress; onLoaded: (puzzles: LibraryPuzzle[], saved: boolean) => void; notice?: string; query?: string; onQuery?: (q: string) => void; hideSolved?: boolean; onHideSolved?: (on: boolean) => void; onOpen?: () => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setLoaded(null);
    try {
      const { puzzles, saved, dropped } = await importLibrary(file);
      if (dropped) setLoaded(`Loaded ${puzzles.length} puzzles (${dropped} couldn't be read).`);
      onLoaded(puzzles, saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      (e.target as HTMLInputElement).value = ''; // so choosing the same file again retries
    }
  };
  const picker = (label: string, primary: boolean) => (
    <label class={`${primary ? 'button primary' : 'link'}${busy ? ' disabled' : ''}`}>
      {busy ? 'Reading…' : label}
      <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy} hidden />
    </label>
  );

  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>Player puzzles</h2>
      </header>
      {notice && <p class="notice">{notice}</p>}
      {library ? (
        <>
          <input
            class="search"
            type="search"
            aria-label="Search puzzles"
            placeholder="Search names and creators"
            value={query}
            onInput={(e) => {
              const q = (e.target as HTMLInputElement).value;
              setQuery(q);
              onQuery(q);
            }}
          />
          {query.trim() ? (
            <Results key={query} library={library} query={query} progress={progress} hideSolved={hideSolved} onHideSolved={onHideSolved} onOpen={onOpen} />
          ) : (
            <nav class="list">
              {groupSummaries(library, progress).map((s) => (
                <a class="tile" href={buildRoute({ name: 'libraryList', group: groupSlug(s.group) })} key={s.label}>
                  <span class="name">{s.label}</span>
                  <span class="muted">{s.solved} of {s.count} solved</span>
                </a>
              ))}
            </nav>
          )}
          <p class="footer">{picker('Load a newer library file', false)}</p>
        </>
      ) : (
        <section class="intro">
          <p>Load the library file made from trainyard.ca's best player puzzles. It stays on this phone.</p>
          {picker('Choose library file', true)}
        </section>
      )}
      {loaded && <p class="notice">{loaded}</p>}
      {error && <p class="error">{error}</p>}
    </main>
  );
}
