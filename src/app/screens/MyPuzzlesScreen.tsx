import type { CustomPuzzle } from '../customPuzzles.ts';
import { proofHolds } from '../editor.ts';
import { buildRoute } from '../router.ts';

export function MyPuzzlesScreen({ puzzles, onNew, onPaste, onShare, message }: { puzzles: CustomPuzzle[]; onNew: () => void; onPaste: () => void; onShare?: (p: CustomPuzzle) => void; message?: string }) {
  const mine = puzzles.filter((p) => p.source === 'mine');
  const shared = puzzles.filter((p) => p.source === 'shared');
  const generated = puzzles.filter((p) => p.source === 'generated');
  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>My puzzles</h2>
      </header>
      <button class="primary wide" onClick={onNew}>New puzzle</button>
      {mine.length > 0 && (
        <nav class="list spaced">
          {mine.map((p) => (
            <a class="tile" href={buildRoute({ name: 'edit', id: p.id })} key={p.id}>
              <span class="name">{p.name}</span>
              {proofHolds(p.code, p.proof) ? <span class="badge">Ready to share</span> : <span class="muted">Not solved yet</span>}
            </a>
          ))}
        </nav>
      )}
      {generated.length > 0 && (
        <>
          <h3>Generated</h3>
          <nav class="list">
            {generated.map((p) => (
              <div class="tile-row" key={p.id}>
                <a class="tile" href={buildRoute({ name: 'play', id: p.id })}>
                  <span class="name">{p.name}</span>
                </a>
                {onShare && proofHolds(p.code, p.proof) && (
                  <button onClick={() => onShare(p)} aria-label={`Share ${p.name}`}>Share</button>
                )}
              </div>
            ))}
          </nav>
        </>
      )}
      <h3>Shared with me</h3>
      {shared.length > 0 ? (
        <nav class="list">
          {shared.map((p) => (
            <a class="tile" href={buildRoute({ name: 'play', id: p.id })} key={p.id}>
              <span class="name">{p.name}</span>
            </a>
          ))}
        </nav>
      ) : (
        <p class="muted">Puzzles people send you appear here.</p>
      )}
      <button class="wide spaced" onClick={onPaste}>Paste puzzle link</button>
      {message && <p class="notice">{message}</p>}
    </main>
  );
}
