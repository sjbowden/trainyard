import { useState } from 'preact/hooks';
import type { LibraryPuzzle } from '../../data/library.ts';
import { groupSlug, groupSummaries } from '../library.ts';
import type { Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';
import { importLibrary } from '../store.ts';

export function LibraryScreen({ library, progress, onLoaded, notice }: { library: LibraryPuzzle[] | null; progress: Progress; onLoaded: (puzzles: LibraryPuzzle[], saved: boolean) => void; notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { puzzles, saved } = await importLibrary(file);
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
          <nav class="list">
            {groupSummaries(library, progress).map((s) => (
              <a class="tile" href={buildRoute({ name: 'libraryList', group: groupSlug(s.group) })} key={s.label}>
                <span class="name">{s.label}</span>
                <span class="muted">{s.solved} of {s.count} solved</span>
              </a>
            ))}
          </nav>
          <p class="footer">{picker('Load a newer library file', false)}</p>
        </>
      ) : (
        <section class="intro">
          <p>Load the library file made from trainyard.ca's best player puzzles. It stays on this phone.</p>
          {picker('Choose library file', true)}
        </section>
      )}
      {error && <p class="error">{error}</p>}
    </main>
  );
}
