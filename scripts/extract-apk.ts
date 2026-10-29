// Dev only: reads an APK in the repo root into local/collections.json (git-ignored).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { readApk } from '../src/data/apk.ts';

const PREFERRED = 'android-comnoodlecaketrainyard-0.apk';
const path = process.argv[2] ?? (existsSync(PREFERRED) ? PREFERRED : readdirSync('.').find((f) => f.endsWith('.apk')));
if (!path) {
  console.error('No APK found. Pass a path or put one in the repo root.');
  process.exit(1);
}

const collections = await readApk(readFileSync(path));
mkdirSync('local', { recursive: true });
writeFileSync('local/collections.json', JSON.stringify(collections, null, 1));
for (const c of collections) console.log(`${c.id}: ${c.worlds.length} worlds, ${c.levels.length} levels, ${c.tutorials.length} tutorials`);
console.log(`Read ${path} → local/collections.json`);
