import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { parseRoute } from './router.ts';
import './styles.css';
import { Updater } from './updates.ts';

const updater = new Updater(
  () => void updateSW(true), // activates the new version and reloads
  () => parseRoute(location.hash).name !== 'puzzle',
);
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => updater.updateFound(),
  onRegisteredSW(_url, registration) {
    // look for a new version whenever the app comes back to the screen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration?.update();
    });
  },
});
addEventListener('hashchange', () => updater.navigated());

render(<App />, document.getElementById('app')!);
