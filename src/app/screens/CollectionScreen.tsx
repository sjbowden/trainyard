import type { Collection, World } from '../../data/apk.ts';
import { isWorldUnlocked, levelKey, starsEarned, type Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';
import { COLLECTION_NAMES } from './HomeScreen.tsx';

export function worldStars(c: Collection, world: string, p: Progress): { earned: number; total: number } {
  const levels = c.levels.filter((l) => l.worldSlug === world);
  return {
    earned: levels.reduce((s, l) => s + (p.levels[levelKey(c.id, l.slug)]?.solved ? l.stars : 0), 0),
    total: levels.reduce((s, l) => s + l.stars, 0),
  };
}

function WorldTile({ c, w, p }: { c: Collection; w: World; p: Progress }) {
  if (!isWorldUnlocked(c, w.slug, p)) {
    return (
      <div class="tile locked">
        <span class="name">{w.name}</span>
        <span class="stars">🔒 {w.starsToUnlock} ★</span>
      </div>
    );
  }
  const { earned, total } = worldStars(c, w.slug, p);
  return (
    <a class="tile" href={buildRoute({ name: 'city', collection: c.id, world: w.slug })}>
      <span class="name">{w.name}</span>
      <span class="stars">{earned} / {total} ★</span>
    </a>
  );
}

export function CollectionScreen({ collection: c, progress: p }: { collection: Collection; progress: Progress }) {
  const groups = [
    { title: null, worlds: c.worlds.filter((w) => w.group === 'main') },
    { title: 'Bonus', worlds: c.worlds.filter((w) => w.group === 'bonus') },
  ].filter((g) => g.worlds.length);
  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>{COLLECTION_NAMES[c.id]}</h2>
        <span class="stars">{starsEarned(c, p)} ★</span>
      </header>
      {groups.map((g) => (
        <section key={g.title ?? 'main'}>
          {g.title && <h3>{g.title}</h3>}
          <nav class="list">
            {g.worlds.map((w) => (
              <WorldTile c={c} w={w} p={p} key={w.slug} />
            ))}
          </nav>
        </section>
      ))}
    </main>
  );
}
