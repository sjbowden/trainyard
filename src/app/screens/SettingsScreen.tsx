import { useState } from 'preact/hooks';
import { buildRoute } from '../router.ts';
import { loadSettings, saveSettings } from '../settings.ts';

export function SettingsScreen() {
  const [settings, setSettings] = useState(loadSettings);
  const toggle = () => {
    const next = { ...settings, showSolvedCard: !settings.showSolvedCard };
    saveSettings(next);
    setSettings(next);
  };
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
        <input type="checkbox" role="switch" checked={settings.showSolvedCard} onChange={toggle} />
      </label>
      <p class="footer">
        <a href={buildRoute({ name: 'load' })}>Load a different APK</a>
      </p>
      <p class="version">Version {__BUILD__}</p>
    </main>
  );
}
