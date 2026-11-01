import { render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import type { Collection } from '../../src/data/apk.ts';
import { emptyProgress, levelKey, recordAttempt } from '../../src/app/progress.ts';
import { CityScreen } from '../../src/app/screens/CityScreen.tsx';
import { CollectionScreen } from '../../src/app/screens/CollectionScreen.tsx';
import { HomeScreen } from '../../src/app/screens/HomeScreen.tsx';

const ty: Collection = {
  id: 'trainyard',
  worlds: [
    { slug: 'abbotsford', name: 'Abbotsford', starsToUnlock: 0, group: 'main', ordinal: 0 },
    { slug: 'brampton', name: 'Brampton', starsToUnlock: 6, group: 'main', ordinal: 1 },
    { slug: 'oakville', name: 'Oakville', starsToUnlock: 424, group: 'bonus', ordinal: 2 },
  ],
  levels: [
    { slug: 'redLine', worldSlug: 'abbotsford', name: 'Red Line', stars: 1, code: 'hh002Oja3Giaa00', ordinal: 1 },
    { slug: 'grorange', worldSlug: 'abbotsford', name: 'Grorange', stars: 2, code: 'hh002Oja3Giaa00', ordinal: 2 },
  ],
  tutorials: [],
};

test('home without collections shows Load APK', () => {
  render(<HomeScreen collections={null} progress={emptyProgress()} />);
  expect(screen.getByText('Load APK')).toBeTruthy();
  expect(screen.queryByText('Trainyard Express')).toBeNull();
});

test('home with collections shows each with stars earned', () => {
  const p = recordAttempt(emptyProgress(), levelKey('trainyard', 'grorange'), 'x', true);
  render(<HomeScreen collections={[ty, { ...ty, id: 'express' }]} progress={p} />);
  expect(screen.getAllByText('Trainyard')).toHaveLength(2); // the title and the collection
  expect(screen.getByText('Trainyard Express')).toBeTruthy();
  expect(screen.getByText('2 ★')).toBeTruthy();
});

test('locked cities show the stars needed', () => {
  render(<CollectionScreen collection={ty} progress={emptyProgress()} />);
  expect(screen.getByText('Abbotsford').closest('a')?.getAttribute('href')).toBe('#/c/trainyard/abbotsford');
  expect(screen.getByText('Brampton').closest('a')).toBeNull();
  expect(screen.getByText('🔒 6 ★')).toBeTruthy();
  expect(screen.getByText('Bonus')).toBeTruthy();
});

test('solving a puzzle updates its tick and the city stars', () => {
  const { rerender } = render(<CityScreen collection={ty} world="abbotsford" progress={emptyProgress()} />);
  expect(screen.queryByLabelText('Solved')).toBeNull();
  expect(screen.getByText('0 / 3 ★')).toBeTruthy();
  rerender(<CityScreen collection={ty} world="abbotsford" progress={recordAttempt(emptyProgress(), 'trainyard/redLine', 'x', true)} />);
  expect(screen.getAllByLabelText('Solved')).toHaveLength(1);
  expect(screen.getByText('1 / 3 ★')).toBeTruthy();
});

test('Settings offers the Original board style only once its art is loaded', async () => {
  const { SettingsScreen } = await import('../../src/app/screens/SettingsScreen.tsx');
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={{ levels: {} }} onProgress={() => {}} />);
  expect((screen.getByRole('radio', { name: 'Original' }) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole('radio', { name: 'Default' }) as HTMLInputElement).checked).toBe(true);
  const hint = screen.getByRole('link', { name: 'Load the APK again to add the original art and sounds' });
  expect(hint.getAttribute('href')).toBe('#/load');
});

test('choosing Original saves it and switches at once', async () => {
  const { SettingsScreen } = await import('../../src/app/screens/SettingsScreen.tsx');
  const { loadSettings } = await import('../../src/app/settings.ts');
  const chosen: string[] = [];
  render(<SettingsScreen hasOriginal onTheme={(id) => chosen.push(id)} progress={{ levels: {} }} onProgress={() => {}} />);
  (screen.getByRole('radio', { name: 'Original' }) as HTMLInputElement).click();
  expect(loadSettings().theme).toBe('original');
  expect(chosen).toEqual(['original']);
  expect(screen.queryByText(/Load the APK again/)).toBeNull();
});
