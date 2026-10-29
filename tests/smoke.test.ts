import { expect, test } from 'vitest';

test('engine module loads', async () => {
  await expect(import('../src/engine/index.ts')).resolves.toBeDefined();
});
