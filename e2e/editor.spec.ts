import { expect, test, type Page } from '@playwright/test';

async function cellPoint(page: Page, col: number, row: number) {
  const box = (await page.locator('canvas.board').boundingBox())!;
  const cell = Math.min(box.width, box.height) / 7;
  return { x: box.x + (box.width - cell * 7) / 2 + (col + 0.5) * cell, y: box.y + (box.height - cell * 7) / 2 + (row + 0.5) * cell };
}

async function tapCell(page: Page, col: number, row: number) {
  const p = await cellPoint(page, col, row);
  await page.mouse.click(p.x, p.y);
}

async function drag(page: Page, row: number, from: number, to: number) {
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

test('make a puzzle, solve it to unlock Share, and lose Share by changing it', async ({ page }) => {
  await makePuzzle(page); // works without an APK
  await expect(page.getByRole('button', { name: 'Share' })).toBeDisabled();

  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByRole('heading', { name: 'Test line' })).toBeVisible();
  await page.waitForTimeout(200);
  await drag(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/editor.png' });

  // tapping a piece opens its sheet
  await tapCell(page, 1, 3);
  await expect(page.getByRole('dialog', { name: 'Outlet' })).toBeVisible();
  await page.screenshot({ path: 'test-results/piece-sheet.png' });
  await page.getByRole('button', { name: 'Right' }).click(); // already selected: nothing changes
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();

  // move the goal: Share locks again
  await page.getByRole('button', { name: 'Erase' }).click();
  await tapCell(page, 5, 3);
  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await tapCell(page, 5, 4);
  await expect(page.getByRole('button', { name: 'Share' })).toBeDisabled();

  // and it is listed, not ready to share
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByText('Test line')).toBeVisible();
  await expect(page.getByText('Not solved yet')).toBeVisible();
});

test('share a puzzle, open the link, paste it into the app once, and reject a damaged link', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await makePuzzle(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await page.waitForTimeout(200);
  await drag(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => {
    (navigator as { share?: unknown }).share = undefined; // use the copy fallback
  });
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#\/s\/1\./);

  // a friend opens it in Safari: playable, with Add to my app
  const friend = await (await browser.newContext()).newPage();
  await friend.goto(link);
  await expect(friend.getByRole('heading', { name: 'Test line' })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Add to my app' })).toBeVisible();
  await expect(friend.locator('canvas.board')).toBeVisible();

  // pasting it into the app twice keeps one copy
  await page.getByRole('link', { name: 'Back' }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Paste puzzle link' }).click();
    await expect(page.getByText('Added “Test line”.')).toBeVisible();
  }
  await expect(page.locator('a[href^="#/play/s-"]')).toHaveCount(1);

  // a damaged link says so
  await friend.goto(link.slice(0, -2) + 'zz');
  await expect(friend.getByText('This puzzle link is damaged.')).toBeVisible();
});

test('in the installed app, opening a link adds the puzzle and opens it', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await makePuzzle(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await page.waitForTimeout(200);
  await drag(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => ((navigator as { share?: unknown }).share = undefined));
  await page.getByRole('button', { name: 'Share' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  const app = await (await browser.newContext()).newPage();
  await app.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes('standalone') ? ({ matches: true } as MediaQueryList) : real(q));
  });
  await app.goto(link);
  await expect(app).toHaveURL(/#\/play\/s-/);
  await expect(app.getByRole('heading', { name: 'Test line' })).toBeVisible();
  await app.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(app.locator('a[href^="#/play/s-"]')).toHaveCount(1);
});

function storedKeys(page: Page, key: string): Promise<string[]> {
  return page.evaluate(
    (k) =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('trainyard');
        open.onsuccess = () => {
          const req = open.result.transaction('kv').objectStore('kv').get(k);
          req.onsuccess = () => {
            const v = req.result;
            resolve(Array.isArray(v) ? v.map((p: { name: string }) => p.name) : Object.keys(v?.levels ?? {}));
          };
        };
      }),
    key,
  );
}

test('a deleted puzzle stays deleted, with its progress', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await makePuzzle(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await page.waitForTimeout(200);
  await drag(page, 3, 1, 4); // leave some track drawn: saved as progress
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // edit, then delete straight away (the edit's save is still pending)
  await page.getByRole('button', { name: 'Rock' }).click();
  await tapCell(page, 3, 0);
  await page.getByRole('button', { name: 'Delete puzzle' }).click();
  await expect(page.getByRole('button', { name: 'New puzzle' })).toBeVisible();
  await page.waitForTimeout(800);
  expect(await storedKeys(page, 'custom/v1')).toEqual([]);

  // another puzzle's save must not bring the deleted one's progress back
  await makePuzzle(page);
  await page.getByRole('button', { name: 'Test' }).click();
  await page.waitForTimeout(200);
  await drag(page, 3, 1, 4);
  await page.waitForTimeout(800);
  expect((await storedKeys(page, 'progress/v1')).length).toBe(1);
  await page.reload();
  await page.goto('./#/mine');
  await expect(page.locator('a[href^="#/edit/"]')).toHaveCount(1);
});

