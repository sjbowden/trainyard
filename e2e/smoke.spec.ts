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

  // Play starts at the very first puzzle, with Abbotsford's tutorial
  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('canvas.board')).toBeVisible();
  await page.waitForTimeout(300);

  await dragAcrossRow(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Continue Grorange lines/ })).toBeVisible();

  // an edit made just before leaving is saved, not lost
  await page.getByRole('link', { name: 'Choose a puzzle' }).first().click();
  await page.getByText('Abbotsford').click();
  await expect(page.getByText('1 / 6 ★')).toBeVisible();
  await page.getByText('Red Line').click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => storedSolution(page, 'trainyard/redLine')).toBe('');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Solved')).toHaveCount(1);
});

test('with the Solved! card turned off, a win opens the next puzzle', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('switch').click();
  await page.getByRole('link', { name: 'Back' }).click();

  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await dragAcrossRow(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Grorange lines' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Solved!')).toHaveCount(0);
});

test('after a crash, a tap anywhere goes back to editing', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await dragAcrossRow(page, 3, 1, 4); // stops one cell short of the goal: the train runs off the track
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Tap anywhere to keep editing')).toBeVisible({ timeout: 15_000 });
  await page.mouse.click(30, 300);
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled(); // the drawing is still there
});

test('the speed setting carries from puzzle to puzzle', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.locator('input[type=range]').fill('0.9');
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.getByRole('link', { name: /^Play Green Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('input[type=range]')).toHaveValue('0.9');
});

test('after a solve, Back to puzzle returns to it, and the header goes home', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await dragAcrossRow(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(page.getByRole('heading', { name: 'Grorange lines' })).toBeVisible();

  // solve nothing here; go back to Red Line through the list and solve again
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Continue Grorange lines/ })).toBeVisible(); // home, not Red Line

  await page.getByRole('link', { name: 'Choose a puzzle' }).first().click();
  await page.getByText('Abbotsford').click();
  await page.getByText('Red Line').click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back to puzzle' }).click();
  await expect(page.getByRole('heading', { name: 'Red Line' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(page.getByText('Solved!')).toHaveCount(0);

  // came from the city list, so Back goes to the city
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('1 / 6 ★')).toBeVisible();
});


test('Erase is a toggle that lights up while erasing', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await dragAcrossRow(page, 3, 1, 5); // the full track
  const erase = page.getByRole('button', { name: 'Erase' });
  await expect(erase).toHaveAttribute('aria-pressed', 'false');
  await erase.click();
  await expect(erase).toHaveAttribute('aria-pressed', 'true');
  await dragAcrossRow(page, 3, 3, 4); // rubs out two cells of track
  await erase.click();
  await expect(erase).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Tap anywhere to keep editing')).toBeVisible({ timeout: 15_000 });
});

test('the Original board style plays Red Line with no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByText('Trainyard Express')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Original' }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Original' })).toBeChecked(); // kept, and its art is stored
  await page.getByRole('link', { name: 'Back' }).click();

  await page.getByRole('link', { name: /^Play Red Line/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/original-red-line.png' });
  await dragAcrossRow(page, 3, 1, 5);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Solved!')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('Next into a new city says so briefly; opening that city from its list does not', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Load APK').click();
  await page.locator('input[type=file]').setInputFiles(apk!);
  await expect(page.getByRole('link', { name: /^Play Red Line/ })).toBeVisible({ timeout: 20_000 }); // saved, not just reading

  // All of Abbotsford solved (which unlocks Brampton), with Purpablu's solution laid down.
  // The solution half comes from fixtures/solutions.json; the puzzle itself comes from the APK.
  await page.evaluate(
    (purpablu) =>
      new Promise<void>((resolve) => {
        const slugs = ['redLine', 'grorangeLines', 'yorpleLines', 'magicalTrains', 'theRedCorner', 'purpablu'];
        const levels = Object.fromEntries(slugs.map((s) => [`trainyard/${s}`, { solved: true, solution: s === 'purpablu' ? purpablu : '' }]));
        const open = indexedDB.open('trainyard');
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ levels }, 'progress/v1');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    '7C5vhQQQQQo01Cv3CQo3ho',
  );
  await page.goto('./#/p/trainyard/purpablu');
  await page.reload();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Next puzzle' }).click({ timeout: 15_000 });

  await expect(page.getByRole('heading', { name: 'A Rock in the Way' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Now in Brampton');
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 6_000 });

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('A Rock in the Way').click();
  await expect(page.getByRole('heading', { name: 'A Rock in the Way' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('status')).toHaveCount(0);
});
