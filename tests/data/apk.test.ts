import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { decodeBoard } from '../../src/engine/codec.ts';
import { readApk, type Collection } from '../../src/data/apk.ts';

const apks = readdirSync('.').filter((f) => f.endsWith('.apk')).sort();

describe.skipIf(apks.length === 0)('readApk', async () => {
  const collections: Collection[] = apks.length ? await readApk(readFileSync(apks[0]!)) : [];
  const byId = Object.fromEntries(collections.map((c) => [c.id, c]));

  test('reads both collections', () => {
    expect(byId.trainyard!.worlds).toHaveLength(23);
    expect(byId.trainyard!.levels).toHaveLength(165);
    expect(byId.express!.worlds).toHaveLength(13);
    expect(byId.express!.levels).toHaveLength(68);
  });

  test('maps world groups and unlock stars', () => {
    const worlds = byId.trainyard!.worlds;
    expect(worlds.find((w) => w.slug === 'oakville')).toMatchObject({ group: 'bonus', starsToUnlock: 424 });
    expect(worlds.find((w) => w.slug === 'brampton')).toMatchObject({ group: 'main', starsToUnlock: 6 });
  });

  test('reads Red Line', () => {
    expect(byId.trainyard!.levels.find((l) => l.slug === 'redLine')).toMatchObject({ code: 'hh002Oja3Giaa00', stars: 1, worldSlug: 'abbotsford' });
  });

  test('reads tutorials', () => {
    expect(byId.trainyard!.tutorials).toHaveLength(8);
    expect(byId.trainyard!.tutorials[0]!.xml).toContain('<tutorial');
  });

  test('every level code decodes', () => {
    for (const c of collections) for (const l of c.levels) expect(() => decodeBoard(l.code), l.slug).not.toThrow();
  });

  test.skipIf(apks.length < 2)('both APKs agree', async () => {
    const other = await readApk(readFileSync(apks[1]!));
    expect(other.map((c) => c.levels)).toEqual(collections.map((c) => c.levels));
  });

  test('rejects a file that is not a Trainyard APK', async () => {
    await expect(readApk(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
