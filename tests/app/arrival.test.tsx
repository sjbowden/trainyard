import { act, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Arrival } from '../../src/app/screens/Arrival.tsx';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('says which city you are now in, then goes after four seconds', () => {
  render(<Arrival city="Brampton" waiting={false} />);
  expect(screen.getByRole('status').textContent).toBe('Now in Brampton');
  act(() => {
    vi.advanceTimersByTime(3_900);
  });
  expect(screen.queryByRole('status')).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByRole('status')).toBeNull();
});

test('waits for the tutorial to close, then gets its full four seconds', () => {
  const { rerender } = render(<Arrival city="Calgary" waiting />);
  expect(screen.queryByRole('status')).toBeNull();
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  rerender(<Arrival city="Calgary" waiting={false} />);
  expect(screen.getByRole('status').textContent).toBe('Now in Calgary');
  act(() => {
    vi.advanceTimersByTime(3_900);
  });
  expect(screen.queryByRole('status')).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByRole('status')).toBeNull();
});
