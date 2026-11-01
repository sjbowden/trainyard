import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { emptyBoard, placePiece } from '../src/app/editor.ts';
import { encodeBoard } from '../src/engine/codec.ts';
import { drag } from './helpers.ts';

// A made-up library: puzzles built with the app's own encoder, never scraped ones.
// Outlet at the left end of row 3, goal at the right end: one straight line solves it.
const CODE = encodeBoard(placePiece(placePiece(emptyBoard(), 21, 'outlet'), 27, 'goal'), { solution: false });
const puzzles = [
  { id: '1', name: 'Straight Shot', creator: 'Tester', wrenches: 7, likes: 50, solves: 5, code: CODE },
  { id: '2', name: 'Second Line', creator: 'Tester', wrenches: 8, likes: 40, solves: 9, code: CODE },
  { id: '3', name: 'Featured One', creator: 'Someone', wrenches: 1, likes: 1, solves: 1, featured: { set: 'Port Credit', order: 0 }, code: CODE },
];

test('load a library, play a puzzle to a win, and keep it after a reload', async ({ page }, info) => {
  const file = info.outputPath('library.json');
  writeFileSync(file, JSON.stringify({ format: 'trainyard-library', version: 1, puzzles }));

  await page.goto('./');
  await page.getByRole('link', { name: /Player puzzles/ }).click();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('link', { name: /Port Credit/ })).toBeVisible();
  await page.getByRole('link', { name: /6–10 wrenches/ }).click();
  await expect(page.getByRole('link', { name: /Straight Shot/ })).toBeVisible();
  await page.getByRole('link', { name: /Straight Shot/ }).click();

  await expect(page.getByRole('heading', { name: 'Straight Shot' })).toBeVisible();
  await expect(page.getByText(/by Tester · 7 🔧 · 50 likes/)).toBeVisible();
  await page.waitForTimeout(200);
  await drag(page, 3, 0, 6);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Next/ })).toBeVisible(); // Second Line follows
  await page.screenshot({ path: 'test-results/library-solved.png' });

  await page.goto('./#/library/w-1');
  await expect(page.getByRole('link', { name: /Straight Shot/ })).toContainText('✓');
  await page.reload();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('link', { name: /6–10 wrenches/ })).toContainText('1 of 2 solved');
  await page.screenshot({ path: 'test-results/library.png' });

  // a newer library file, with new counts and one more puzzle, keeps the solve
  const newer = info.outputPath('library-newer.json');
  const added = { ...puzzles[1]!, id: '4', name: 'Third Line' };
  writeFileSync(newer, JSON.stringify({ format: 'trainyard-library', version: 1, puzzles: [...puzzles.map((p) => ({ ...p, likes: p.likes + 1 })), added] }));
  await page.locator('input[type=file]').setInputFiles(newer);
  await expect(page.getByRole('link', { name: /6–10 wrenches/ })).toContainText('1 of 3 solved');
  await page.reload();
  await expect(page.getByRole('link', { name: /6–10 wrenches/ })).toContainText('1 of 3 solved');
});

test('a file that is not a library is refused with a plain message', async ({ page }, info) => {
  const file = info.outputPath('not-a-library.json');
  writeFileSync(file, '{"hello": 1}');
  await page.goto('./#/library');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText("That file isn't a Trainyard library.")).toBeVisible();
});

test('an old link to a puzzle that is not loaded shows the library screen', async ({ page }) => {
  await page.goto('./#/library/w-1/999');
  await expect(page.getByText('Choose library file')).toBeVisible();
});

test('with the Solved! card turned off, a library win opens the next puzzle', async ({ page }, info) => {
  const file = info.outputPath('library.json');
  writeFileSync(file, JSON.stringify({ format: 'trainyard-library', version: 1, puzzles }));
  await page.goto('./#/library');
  await page.evaluate(() => localStorage.setItem('trainyard.settings', JSON.stringify({ showSolvedCard: false })));
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('link', { name: /6–10 wrenches/ }).click();
  await page.getByRole('link', { name: /Straight Shot/ }).click();
  await page.waitForTimeout(200);
  await drag(page, 3, 0, 6);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Second Line' })).toBeVisible({ timeout: 15_000 });
});
