// Draws the app icons (our own design: a green track curve on a dark tile) into public/.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

function icon(size: number): Buffer {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b1416';
  ctx.fillRect(0, 0, size, size);
  const s = size / 512;
  ctx.lineCap = 'round';
  const cx = 386 * s;
  const cy = 386 * s;
  // sleepers
  ctx.strokeStyle = '#1f3a42';
  ctx.lineWidth = 26 * s;
  for (let a = Math.PI * 1.04; a < Math.PI * 1.5; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 140 * s, cy + Math.sin(a) * 140 * s);
    ctx.lineTo(cx + Math.cos(a) * 310 * s, cy + Math.sin(a) * 310 * s);
    ctx.stroke();
  }
  // rails
  ctx.strokeStyle = '#4fd18b';
  ctx.lineWidth = 30 * s;
  for (const r of [180, 270]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * s, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  }
  return c.toBuffer('image/png');
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', icon(192));
writeFileSync('public/icon-512.png', icon(512));
writeFileSync('public/apple-touch-icon.png', icon(180));
console.log('Wrote public/icon-192.png, icon-512.png, apple-touch-icon.png');
