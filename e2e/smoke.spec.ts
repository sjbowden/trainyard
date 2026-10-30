import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const apk = readdirSync('.').filter((f) => f.endsWith('.apk')).sort()[0];

async function dragAcrossRow(page: Page, row: number, fromCol: number, toCol: number) {
  const box = (await page.locator('canvas.board').boundingBox())!;
  const cell = Math.min(box.width, box.height) / 7;
  const ox = box.x + (box.width - cell * 7) / 2;
  const oy = box.y + (box.height - cell * 7) / 2;
  const y = oy + (row + 0.5) * cell;
  const x0 = ox + (fromCol + 0.5) * cell;
  const x1 = ox + (toCol + 0.5) * cell;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y);
  await page.mouse.up();
}

function storedSolution(page: Page, key: string): Promise<string | undefined> {
  return page.evaluate(
    (k) =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('trainyard');
        open.onsuccess = () => {
          const req = open.result.transaction('kv').objectStore('kv').get('progress/v1');
          req.onsuccess = () => resolve(req.result?.levels?.[k]?.solution);
        };
      }),
    key,
  );
}

test.skip(!apk, 'needs an APK in the repo root');

test('load the APK, solve Red Line, and keep it offline', async ({ page, context }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });

  await page.getByText('Trainyard', { exact: true }).nth(1).click();
  await page.getByText('Abbotsford').click();
  await page.getByRole('button', { name: 'Close' }).click(); // first-visit tutorial
  await page.getByText('Red Line').click();
  await expect(page.locator('canvas.board')).toBeVisible();
  await page.waitForTimeout(300);

  await dragAcrossRow(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });

  await page.getByText('Back to city').click();
  await expect(page.getByText('1 / 6 ★')).toBeVisible();

  // an edit made just before leaving is saved, not lost
  await page.getByText('Red Line').click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => storedSolution(page, 'trainyard/redLine')).toBe('');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Solved')).toHaveCount(1);
});
