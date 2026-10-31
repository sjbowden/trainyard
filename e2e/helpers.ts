import { expect, type Page } from '@playwright/test';

export async function cellPoint(page: Page, col: number, row: number) {
  const box = (await page.locator('canvas.board').boundingBox())!;
  const cell = Math.min(box.width, box.height) / 7;
  return { x: box.x + (box.width - cell * 7) / 2 + (col + 0.5) * cell, y: box.y + (box.height - cell * 7) / 2 + (row + 0.5) * cell };
}

export async function tapCell(page: Page, col: number, row: number) {
  const p = await cellPoint(page, col, row);
  await page.mouse.click(p.x, p.y);
}

export async function drag(page: Page, row: number, from: number, to: number) {
  const a = await cellPoint(page, from, row);
  const b = await cellPoint(page, to, row);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y);
  await page.mouse.up();
}

/** Makes "Test line" (outlet at (1,3), goal at (5,3)) and returns to the editor. */
export async function makePuzzle(page: Page) {
  await page.goto('./');
  await page.getByRole('link', { name: /My puzzles/ }).click();
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await page.getByLabel('Puzzle name').fill('Test line');
  await expect(page.locator('canvas.board')).toBeVisible();
  await page.waitForTimeout(200);
  await tapCell(page, 1, 3); // Outlet is the starting tool
  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await tapCell(page, 5, 3);
}

