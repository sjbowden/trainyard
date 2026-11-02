import { fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test, vi } from 'vitest';
import type { Progress } from '../../src/app/progress.ts';
import { progressFileText } from '../../src/app/progressFile.ts';
import { SettingsScreen } from '../../src/app/screens/SettingsScreen.tsx';

afterEach(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

const here: Progress = { levels: { 'trainyard/redLine': { solved: true, solution: 'a', at: 1 } } };
const there: Progress = { levels: { 'trainyard/grorangeLines': { solved: true, solution: 'b', at: 2 }, 'trainyard/yorpleLines': { solved: true, solution: 'c', at: 3 } } };

const choose = (text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File([text], 'progress.json')], configurable: true });
  fireEvent.change(input);
};

test('loading a progress file merges it in and says how many puzzles it added', async () => {
  const merged: Progress[] = [];
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={(p) => merged.push(p)} />);
  choose(progressFileText(there));
  expect(await screen.findByText('Added 2 solved puzzles.')).toBeTruthy();
  expect(merged).toEqual([{ levels: { ...here.levels, ...there.levels } }]);
});

test('a file with nothing new says so', async () => {
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={() => {}} />);
  choose(progressFileText(here));
  expect(await screen.findByText('No new solved puzzles in that file.')).toBeTruthy();
});

test('a file that is not a progress file is refused and changes nothing', async () => {
  const onProgress = vi.fn();
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={onProgress} />);
  choose('{"format":"trainyard-library","version":1,"puzzles":[]}');
  expect(await screen.findByText("That file isn't a Trainyard progress file.")).toBeTruthy();
  expect(onProgress).not.toHaveBeenCalled();
});

test('saving hands a dated progress file to the share sheet', async () => {
  const shared: File[] = [];
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share: async ({ files }: { files: File[] }) => void shared.push(...files) });
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={() => {}} />);
  screen.getByRole('button', { name: 'Save progress' }).click();
  await vi.waitFor(() => expect(shared).toHaveLength(1));
  expect(shared[0]!.name).toMatch(/^trainyard-progress-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await shared[0]!.text()).levels).toEqual(here.levels);
});

test('without a share sheet, saving downloads the file instead', async () => {
  vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:progress', revokeObjectURL: () => {} }));
  const clicked: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={() => {}} />);
  screen.getByRole('button', { name: 'Save progress' }).click();
  await vi.waitFor(() => expect(clicked).toHaveLength(1));
  expect(clicked[0]!.download).toMatch(/^trainyard-progress-.*\.json$/);
  expect(clicked[0]!.href).toBe('blob:progress');
});

test('if the share sheet fails for a reason other than closing it, saving downloads the file instead', async () => {
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share: async () => { throw new DOMException('no', 'NotAllowedError'); } });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:progress', revokeObjectURL: () => {} }));
  const clicked: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
  render(<SettingsScreen hasOriginal={false} onTheme={() => {}} progress={here} onProgress={() => {}} />);
  screen.getByRole('button', { name: 'Save progress' }).click();
  await vi.waitFor(() => expect(clicked).toHaveLength(1));
});
