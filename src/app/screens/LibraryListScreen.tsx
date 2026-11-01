import { useEffect, useRef, useState } from 'preact/hooks';
import type { LibraryPuzzle } from '../../data/library.ts';
import { groupLabel, groupPuzzles, groupSlug, libraryKey, type LibraryGroup, type LibrarySort } from '../library.ts';
import type { Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';

const PAGE = 100;
const SORTS: { id: LibrarySort; label: string }[] = [
  { id: 'likes', label: 'Most liked' },
  { id: 'solves', label: 'Most solved' },
];

/** `focusId` is the puzzle just played: the list opens far enough down to show it, scrolled to it. */
export function LibraryListScreen({ library, group, progress, sort, onSort, focusId }: { library: LibraryPuzzle[]; group: LibraryGroup; progress: Progress; sort: LibrarySort; onSort: (s: LibrarySort) => void; focusId?: string }) {
  const list = groupPuzzles(library, group, sort);
  const [shown, setShown] = useState(() => Math.max(PAGE, Math.ceil((list.findIndex((p) => p.id === focusId) + 1) / PAGE) * PAGE));
  const focused = useRef<HTMLAnchorElement>(null);
  useEffect(() => focused.current?.scrollIntoView({ block: 'center' }), []);
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
          <a class="tile library-row" ref={p.id === focusId ? focused : undefined} href={buildRoute({ name: 'libraryPuzzle', group: slug, id: p.id })} key={p.id}>
            <span>
              <span class="name">{p.name}</span>
              {p.creator.trim() && <span class="muted by">by {p.creator}</span>}
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
