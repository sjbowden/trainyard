import { useState } from 'preact/hooks';
import type { Progress } from '../progress.ts';
import { mergeProgress, parseProgressFile } from '../progressFile.ts';
import { buildRoute } from '../router.ts';
import { saveProgressFile } from '../sharing.ts';
import { loadSettings, saveSettings, type Settings } from '../settings.ts';

export interface SettingsScreenProps {
  /** Whether the Original theme's art was kept from the APK. */
  hasOriginal: boolean;
  onTheme: (theme: Settings['theme']) => void;
  progress: Progress;
  /** Called with this device's progress merged with a loaded file's. */
  onProgress: (merged: Progress) => void;
}

const STYLES: { id: Settings['theme']; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'original', label: 'Original' },
];

export function SettingsScreen({ hasOriginal, onTheme, progress, onProgress }: SettingsScreenProps) {
  const [settings, setSettings] = useState(loadSettings);
  const [sync, setSync] = useState<string | null>(null);
  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setSync("Couldn't read the file. Check your connection and try again.");
      return;
    } finally {
      input.value = ''; // so choosing the same file again retries
    }
    try {
      const { progress: merged, newlySolved } = mergeProgress(progress, parseProgressFile(text));
      onProgress(merged);
      setSync(newlySolved ? `Added ${newlySolved} solved puzzle${newlySolved === 1 ? '' : 's'}.` : 'No new solved puzzles in that file.');
    } catch (err) {
      setSync((err as Error).message);
    }
  };
  const change = (patch: Partial<Settings>) => {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    setSettings(next);
  };
  const style = hasOriginal ? settings.theme : 'default';
  return (
    <main class="screen">
      <header class="bar">
        <a class="button" href={buildRoute({ name: 'home' })} aria-label="Back">‹</a>
        <h2>Settings</h2>
      </header>
      <label class="tile setting">
        <span>
          <span class="name">Show “Solved!” after each puzzle</span>
          <span class="hint">{settings.showSolvedCard ? 'Tap Next puzzle to go on.' : 'The next puzzle opens by itself.'}</span>
        </span>
        <input type="checkbox" role="switch" checked={settings.showSolvedCard} onChange={() => change({ showSolvedCard: !settings.showSolvedCard })} />
      </label>
      <fieldset class="tile setting">
        <legend class="name">Board style</legend>
        <div class="choices">
          {STYLES.map((s) => (
            <label key={s.id}>
              <input
                type="radio"
                name="theme"
                checked={style === s.id}
                disabled={s.id === 'original' && !hasOriginal}
                onChange={() => {
                  change({ theme: s.id });
                  onTheme(s.id);
                }}
              />
              {s.label}
            </label>
          ))}
        </div>
        {!hasOriginal && (
          <a class="hint" href={buildRoute({ name: 'load' })}>Load the APK again to add the original art and sounds</a>
        )}
      </fieldset>
      <div class="tile setting sync">
        <span class="name">Progress</span>
        <span class="hint">Move your solved puzzles between your iPhone and iPad: save here, then load the file on the other device.</span>
        <div class="choices">
          <button onClick={() => void saveProgressFile(progress)}>Save progress</button>
          <label class="button">
            Load progress
            <input type="file" accept=".json,application/json" onChange={onFile} hidden />
          </label>
        </div>
        {sync && <p class="hint" role="status">{sync}</p>}
      </div>
      <p class="footer">
        <a href={buildRoute({ name: 'load' })}>Load a different APK</a>
      </p>
      <p class="version">Version {__BUILD__}</p>
    </main>
  );
}
