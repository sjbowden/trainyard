import type { Collection } from '../../data/apk.ts';
import { levelKey, type Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';
import { worldStars } from './CollectionScreen.tsx';

export function CityScreen({ collection: c, world, progress: p, onTutorial }: { collection: Collection; world: string; progress: Progress; onTutorial?: () => void }) {
  const w = c.worlds.find((x) => x.slug === world);
  const levels = c.levels.filter((l) => l.worldSlug === world).sort((a, b) => a.ordinal - b.ordinal);
  const { earned, total } = worldStars(c, world, p);
  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'collection', collection: c.id })} aria-label="Back">‹</a>
        <h2>{w?.name ?? world}</h2>
        {onTutorial && <button onClick={onTutorial} aria-label="How to play">?</button>}
      </header>
      <p class="stars summary">{earned} / {total} ★</p>
      <nav class="grid">
        {levels.map((l) => {
          const solved = p.levels[levelKey(c.id, l.slug)]?.solved;
          return (
            <a class={`level${solved ? ' solved' : ''}`} href={buildRoute({ name: 'puzzle', collection: c.id, slug: l.slug })} key={l.slug}>
              <span class="name">{l.name}</span>
              <span class="stars">{l.stars} ★</span>
              {solved && <span class="tick" aria-label="Solved">✓</span>}
            </a>
          );
        })}
      </nav>
    </main>
  );
}
