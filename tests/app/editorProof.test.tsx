import { act, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test, vi } from 'vitest';
import type { CustomPuzzle } from '../../src/app/customPuzzles.ts';
import { defaultTheme } from '../../src/app/theme/default.ts';
import { CODE } from './libraryFixture.ts';

// A solver the test finishes when it chooses.
let finish: (r: { status: 'solved'; solution: string }) => void = () => {};
vi.mock('../../src/app/solverClient.ts', () => ({
  solveInWorker: () => ({ result: new Promise((resolve) => (finish = resolve)), cancel: () => {} }),
}));
const { EditorScreen } = await import('../../src/app/screens/EditorScreen.tsx');

afterEach(() => vi.useRealTimers());

test('renaming just before the solver finishes does not lose its proof', async () => {
  vi.useFakeTimers();
  const saves: CustomPuzzle[] = [];
  const puzzle: CustomPuzzle = { id: 'm-1', source: 'mine', name: 'Old', code: CODE, proof: null, created: 1 };
  render(<EditorScreen puzzle={puzzle} onSave={(p) => saves.push(p)} onTest={() => {}} onDelete={() => {}} theme={defaultTheme} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask the solver' }));
  fireEvent.input(screen.getByRole('textbox', { name: 'Puzzle name' }), { target: { value: 'New' } });
  await act(async () => {
    finish({ status: 'solved', solution: 'proof' });
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(saves.at(-1)).toMatchObject({ name: 'New', proof: 'proof' });
});
