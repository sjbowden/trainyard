// Dev only: finds the sprites in the original's atlas so they can be labeled by hand in
// src/app/theme/original/frames.ts (the atlas's own index doesn't match the image). Writes
// local/atlas-sheet.png, the atlas with each sprite boxed and numbered, and local/atlas-regions.json.
// Both stay in local/: the art is never committed.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';

const apk = readdirSync('.').find((f) => f.endsWith('.apk'));
if (!apk) throw new Error('Put the Trainyard APK in the repo root first.');
const files = unzipSync(readFileSync(apk), { filter: (f) => f.name === 'assets/FullAtlasHD.png' });
const png = PNG.sync.read(Buffer.from(files['assets/FullAtlasHD.png']!));
const { width: W, height: H, data } = png;

// Sprites are connected regions of alpha > 0; pixels up to GAP apart count as connected.
const GAP = 2;
const solid = (x: number, y: number) => data[(y * W + x) * 4 + 3]! > 0;
const seen = new Uint8Array(W * H);
interface Region { id: number; x: number; y: number; w: number; h: number }
const regions: Region[] = [];
for (let y0 = 0; y0 < H; y0++) {
  for (let x0 = 0; x0 < W; x0++) {
    if (seen[y0 * W + x0] || !solid(x0, y0)) continue;
    let [minX, minY, maxX, maxY] = [x0, y0, x0, y0];
    const stack = [y0 * W + x0];
    seen[y0 * W + x0] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W, y = (p - x) / W;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -GAP; dy <= GAP; dy++) {
        for (let dx = -GAP; dx <= GAP; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !solid(nx, ny)) continue;
          seen[ny * W + nx] = 1;
          stack.push(ny * W + nx);
        }
      }
    }
    regions.push({ id: regions.length, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
}

// A 3×5 digit font, enough to number the boxes.
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const set = (x: number, y: number, rgb: number[]) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...rgb, 255];
};
for (const r of regions) {
  const color = [255, 0, 255];
  for (let x = r.x - 1; x <= r.x + r.w; x++) { set(x, r.y - 1, color); set(x, r.y + r.h, color); }
  for (let y = r.y - 1; y <= r.y + r.h; y++) { set(r.x - 1, y, color); set(r.x + r.w, y, color); }
  [...String(r.id)].forEach((d, k) => {
    const bits = DIGITS[Number(d)]!;
    for (let i = 0; i < 15; i++) {
      if (bits[i] !== '1') continue;
      for (let s = 0; s < 4; s++) set(r.x + 1 + k * 16 + (i % 3) * 4 + (s % 2), r.y + 1 + Math.floor(i / 3) * 4 + (s >> 1), [0, 255, 0]);
    }
  });
}
writeFileSync('local/atlas-sheet.png', PNG.sync.write(png));
writeFileSync('local/atlas-regions.json', JSON.stringify(regions, null, 1) + '\n');
console.log(`${regions.length} regions → local/atlas-sheet.png, local/atlas-regions.json`);
