import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import { App } from '../../src/app/App.tsx';

test('App renders the title and offers to load an APK on first run', async () => {
  render(<App />);
  expect(await screen.findByText('Trainyard')).toBeTruthy();
  expect(screen.getByText('Load APK')).toBeTruthy();
});
