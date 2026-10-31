import type { Collection } from '../../data/apk.ts';
import { firstUnsolved } from '../levels.ts';
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
          {collections.map((c) => {
            const next = firstUnsolved(c, progress);
            const started = starsEarned(c, progress) > 0;
            return (
              <section class="collection" key={c.id}>
                <div class="heading">
                  <h2>{COLLECTION_NAMES[c.id]}</h2>
                  <span class="stars">{starsEarned(c, progress)} ★</span>
                </div>
                {next ? (
                  <a class="button primary play" href={buildRoute({ name: 'puzzle', collection: c.id, slug: next.slug })}>
                    {started ? 'Continue' : 'Play'} <span class="next-name">{next.name}</span>
                  </a>
                ) : (
                  <p class="done">Every unlocked puzzle is solved.</p>
                )}
                <a class="choose" href={buildRoute({ name: 'collection', collection: c.id })}>Choose a puzzle</a>
              </section>
            );
          })}
        </>
      ) : (
        <section class="intro">
          <p>Open your Trainyard APK to load the original puzzles. It stays on this phone.</p>
          <a class="button primary" href={buildRoute({ name: 'load' })}>Load APK</a>
        </section>
      )}
      <a class="tile spaced" href={buildRoute({ name: 'new' })}>
        <span class="name">New puzzle for me</span>
        <span class="muted">Easy to very hard</span>
      </a>
      <a class="tile spaced" href={buildRoute({ name: 'mine' })}>
        <span class="name">My puzzles</span>
        <span class="muted">Make and share</span>
      </a>
      <p class="footer">
        <a href={buildRoute({ name: 'settings' })}>Settings</a>
      </p>
    </main>
  );
}
