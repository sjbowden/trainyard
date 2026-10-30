import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import './styles.css';

registerSW({ immediate: true }); // updates apply the next time the app starts (registerType: 'prompt')
render(<App />, document.getElementById('app')!);
