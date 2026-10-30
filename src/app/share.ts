import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { CodecError, decodeBoard, splitCode } from '../engine/codec.ts';

/**
 * Share links carry a whole puzzle: `#/s/<payload>`, where the payload is
 * `1.` + base64url(deflate(JSON {n: name, c: code})) + `.` + an FNV-1a checksum of the text
 * before the last dot. The checksum means a damaged link is refused, never misread.
 */

export interface SharedPuzzle {
  name: string;
  /** A puzzle-only code (no solution half). */
  code: string;
}

export class LinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkError';
  }
}

const VERSION = '1';
const MAX_NAME = 40;
const DAMAGED = 'This puzzle link is damaged.';

function cleanName(name: string): string {
  return [...name.trim()].slice(0, MAX_NAME).join('').trim() || 'Untitled';
}

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of strToU8(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function checkCode(code: string): void {
  try {
    if (splitCode(code).solution) throw new CodecError('has a solution');
    decodeBoard(code);
  } catch {
    throw new LinkError(DAMAGED);
  }
}

export function encodeShare(p: SharedPuzzle): string {
  checkCode(p.code);
  const body = `${VERSION}.${toBase64Url(deflateSync(strToU8(JSON.stringify({ n: cleanName(p.name), c: p.code }))))}`;
  return `${body}.${checksum(body)}`;
}

export function decodeShare(payload: string): SharedPuzzle {
  const m = /^(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(payload.trim());
  if (!m) throw new LinkError(DAMAGED);
  const [, version, data, sum] = m;
  if (version !== VERSION) throw new LinkError('This puzzle link needs a newer version of the app.');
  if (checksum(`${version}.${data}`) !== sum) throw new LinkError(DAMAGED);
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(inflateSync(fromBase64Url(data!))));
  } catch {
    throw new LinkError(DAMAGED);
  }
  const { n, c } = (parsed ?? {}) as { n?: unknown; c?: unknown };
  if (typeof n !== 'string' || typeof c !== 'string') throw new LinkError(DAMAGED);
  checkCode(c);
  return { name: cleanName(n), code: c };
}

export function shareUrl(p: SharedPuzzle, base = `${location.origin}/trainyard/`): string {
  return `${base}#/s/${encodeShare(p)}`;
}
