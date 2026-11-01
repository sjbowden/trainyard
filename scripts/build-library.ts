// Dev only: turns the scrape (local/library-raw.json) into the file the player loads onto the
// phone, local/trainyard-library.json. Neither file is ever committed or published.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildLibraryFile } from '../src/data/library.ts';

const OUT = 'local/trainyard-library.json';
const { text, kept, dropped } = buildLibraryFile(JSON.parse(readFileSync('local/library-raw.json', 'utf8')));
writeFileSync(OUT, text);
console.log(`${kept} kept, ${dropped} dropped → ${OUT} (${Math.round(text.length / 1024)} KB)`);
