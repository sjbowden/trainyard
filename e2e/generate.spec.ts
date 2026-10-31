import { expect, test } from '@playwright/test';
import { makePuzzle } from './helpers.ts';

test('a fresh easy puzzle opens, and is kept under Generated, ready to share', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await page.getByRole('link', { name: /New puzzle for me/ }).click();
  await page.getByRole('button', { name: /^Easy/ }).click();
  await expect(page.getByRole('heading', { name: /^Easy #\d+/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('canvas.board')).toBeVisible();
  await page.screenshot({ path: 'test-results/generated.png' });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Generated')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Share Easy #/ })).toBeVisible();
});

test('Ask the solver proves a puzzle so it can be shared', async ({ page }) => {
  await makePuzzle(page);
  await expect(page.getByRole('button', { name: 'Share' })).toBeDisabled();
  await page.getByRole('button', { name: 'Ask the solver' }).click();
  await expect(page.getByText('The solver found a solution.')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
});
