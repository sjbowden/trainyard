import { render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import { App } from '../../src/app/App.tsx';

test('App renders the title', () => {
  render(<App />);
  expect(screen.getByText('Trainyard')).toBeTruthy();
});
