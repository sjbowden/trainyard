import { useState } from 'preact/hooks';
import { buildRoute } from '../router.ts';
import { loadSettings, saveSettings, type Settings } from '../settings.ts';

export interface SettingsScreenProps {
  /** Whether the Original theme's art was kept from the APK. */
  hasOriginal: boolean;
  onTheme: (theme: Settings['theme']) => void;
}

const STYLES: { id: Settings['theme']; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'original', label: 'Original' },
];

export function SettingsScreen({ hasOriginal, onTheme }: SettingsScreenProps) {
  const [settings, setSettings] = useState(loadSettings);
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
      <p class="footer">
        <a href={buildRoute({ name: 'load' })}>Load a different APK</a>
      </p>
      <p class="version">Version {__BUILD__}</p>
    </main>
  );
}
