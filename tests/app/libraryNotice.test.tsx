import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test, vi } from 'vitest';
import { libraryText, puzzle } from './libraryFixture.ts';

vi.mock('../../src/app/store.ts', async (actual) => {
  const real = await actual<typeof import('../../src/app/store.ts')>();
  return { ...real, importLibrary: async (file: Blob) => ({ ...(await real.importLibrary(file)), saved: false }) };
});
const { App } = await import('../../src/app/App.tsx');

afterEach(() => {
  location.hash = '';
});

test("a library the phone wouldn't save still loads, with a notice to load it again next time", async () => {
  location.hash = '#/library';
  render(<App />);
  await screen.findByText('Choose library file');
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File([libraryText([puzzle('1')])], 'library.json')] });
  fireEvent.change(input);
  expect(await screen.findByText("This phone wouldn't save the library, so you'll need to load it again next time.")).toBeTruthy();
  expect(screen.getByRole('link', { name: /6–10 wrenches/ })).toBeTruthy();
});
