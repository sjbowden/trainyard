import type { Collection } from '../../data/apk.ts';
import { starsEarned, type Progress } from '../progress.ts';
import { buildRoute } from '../router.ts';

export const COLLECTION_NAMES: Record<Collection['id'], string> = { trainyard: 'Trainyard', express: 'Trainyard Express' };

export function HomeScreen({ collections, progress, notice }: { collections: Collection[] | null; progress: Progress; notice?: string }) {
  return (
    <main class="screen">
      <h1>Trainyard</h1>
      {notice && <p class="notice">{notice}</p>}
      {collections ? (
        <>
          <nav class="list">
            {collections.map((c) => (
              <a class="tile" href={buildRoute({ name: 'collection', collection: c.id })} key={c.id}>
                <span class="name">{COLLECTION_NAMES[c.id]}</span>
                <span class="stars">{starsEarned(c, progress)} ★</span>
              </a>
            ))}
          </nav>
          <p class="footer">
            <a href={buildRoute({ name: 'load' })}>Load a different APK</a>
          </p>
        </>
      ) : (
        <section class="intro">
          <p>Open your Trainyard APK to load the original puzzles. It stays on this phone.</p>
          <a class="button primary" href={buildRoute({ name: 'load' })}>Load APK</a>
        </section>
      )}
    </main>
  );
}
