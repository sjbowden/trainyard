import { useState } from 'preact/hooks';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Collection } from '../../data/apk.ts';
import { buildRoute } from '../router.ts';
import { importApk } from '../store.ts';

export function LoadApkScreen({ onLoaded }: { onLoaded: (c: Collection[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onLoaded(await importApk(file, wasmUrl));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>Load APK</h2>
      </header>
      <section class="intro">
        <p>Choose the Trainyard or Trainyard Express APK file (save it to Files or iCloud Drive first). The puzzles are read on this phone and kept here. Nothing is uploaded.</p>
        <label class={`button primary${busy ? ' disabled' : ''}`}>
          {busy ? 'Reading…' : 'Choose APK file'}
          <input type="file" accept=".apk,application/vnd.android.package-archive,application/zip,application/octet-stream" onChange={onFile} disabled={busy} hidden />
        </label>
        {error && <p class="error">{error}</p>}
      </section>
    </main>
  );
}
