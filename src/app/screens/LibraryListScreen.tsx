import { useState } from 'preact/hooks';
import type { LibraryPuzzle } from '../../data/library.ts';
import { groupLabel, groupPuzzles, groupSlug, libraryKey, type LibraryGroup, type LibrarySort } from '../library.ts';
import type { Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';

const PAGE = 100;
const SORTS: { id: LibrarySort; label: string }[] = [
  { id: 'likes', label: 'Most liked' },
  { id: 'solves', label: 'Most solved' },
];

export function LibraryListScreen({ library, group, progress, sort, onSort }: { library: LibraryPuzzle[]; group: LibraryGroup; progress: Progress; sort: LibrarySort; onSort: (s: LibrarySort) => void }) {
  const [shown, setShown] = useState(PAGE);
  const list = groupPuzzles(library, group, sort);
  const slug = groupSlug(group);
  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'library' })} aria-label="Back">‹</a>
        <h2>{groupLabel(group)}</h2>
      </header>
      {group.kind === 'band' && (
        <div class="choices sort">
          {SORTS.map((s) => (
            <button key={s.id} class={sort === s.id ? 'on' : ''} aria-pressed={sort === s.id} onClick={() => onSort(s.id)}>{s.label}</button>
          ))}
        </div>
      )}
      <nav class="list spaced">
        {list.slice(0, shown).map((p) => (
          <a class="tile library-row" href={buildRoute({ name: 'libraryPuzzle', group: slug, id: p.id })} key={p.id}>
            <span>
              <span class="name">{p.name}</span>
              <span class="muted by">by {p.creator}</span>
            </span>
            <span class="muted">
              {progress.levels[libraryKey(p.id)]?.solved && <span class="solved">✓ </span>}
              {p.wrenches} 🔧 · {sort === 'solves' && group.kind === 'band' ? `${p.solves} solves` : `${p.likes} likes`}
            </span>
          </a>
        ))}
      </nav>
      {list.length > shown && <button class="wide spaced" onClick={() => setShown(shown + PAGE)}>Show more</button>}
    </main>
  );
}
