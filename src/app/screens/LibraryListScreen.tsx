import type { Ref } from 'preact';
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

/** One puzzle in a list: its name, creator, whether it's solved, its wrenches and its likes or solves. */
export function LibraryRow({ p, href, progress, showSolves = false, focused, onClick }: { p: LibraryPuzzle; href: string; progress: Progress; showSolves?: boolean; focused?: Ref<HTMLAnchorElement>; onClick?: () => void }) {
  return (
    <a class="tile library-row" ref={focused} href={href} onClick={onClick}>
      <span>
        <span class="name">{p.name}</span>
        {p.creator.trim() && <span class="muted by">by {p.creator}</span>}
      </span>
      <span class="muted">
        {progress.levels[libraryKey(p.id)]?.solved && <span class="solved">✓ </span>}
        {p.wrenches} 🔧 · {showSolves ? `${p.solves} solves` : `${p.likes} likes`}
      </span>
    </a>
  );
}

export function HideSolved({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label class="hide-solved">
      <input type="checkbox" checked={on} onChange={() => onChange(!on)} />
      Hide solved
    </label>
  );
}

/** Drops solved puzzles when hiding them, keeping `keepId` (the puzzle just played) so you keep your place. */
export function visible(list: LibraryPuzzle[], progress: Progress, hideSolved: boolean, keepId?: string): LibraryPuzzle[] {
  return hideSolved ? list.filter((p) => p.id === keepId || !progress.levels[libraryKey(p.id)]?.solved) : list;
}

/** `focusId` is the puzzle just played: the list opens far enough down to show it, scrolled to it. */
export function LibraryListScreen({ library, group, progress, sort, onSort, hideSolved = false, onHideSolved = () => {}, focusId }: { library: LibraryPuzzle[]; group: LibraryGroup; progress: Progress; sort: LibrarySort; onSort: (s: LibrarySort) => void; hideSolved?: boolean; onHideSolved?: (on: boolean) => void; focusId?: string }) {
  const list = visible(groupPuzzles(library, group, sort), progress, hideSolved, focusId);
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
      <HideSolved on={hideSolved} onChange={onHideSolved} />
      <nav class="list spaced">
        {list.slice(0, shown).map((p) => (
          <LibraryRow key={p.id} p={p} href={buildRoute({ name: 'libraryPuzzle', group: slug, id: p.id })} progress={progress} showSolves={sort === 'solves' && group.kind === 'band'} focused={p.id === focusId ? focused : undefined} />
        ))}
      </nav>
      {list.length > shown && <button class="wide spaced" onClick={() => setShown(shown + PAGE)}>Show more</button>}
    </main>
  );
}
