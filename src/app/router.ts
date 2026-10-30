import type { Collection } from '../data/apk.ts';

/** Hash routes, so the app works from any static host and from the home screen. */

type CollectionId = Collection['id'];

export type Route =
  | { name: 'home' }
  | { name: 'load' }
  | { name: 'collection'; collection: CollectionId }
  | { name: 'city'; collection: CollectionId; world: string }
  | { name: 'puzzle'; collection: CollectionId; slug: string };

const isCollection = (s: string | undefined): s is CollectionId => s === 'trainyard' || s === 'express';

export function parseRoute(hash: string): Route {
  let parts: string[];
  try {
    parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  } catch {
    return { name: 'home' }; // a damaged link
  }
  const [first, c, rest] = parts;
  if (first === 'load') return { name: 'load' };
  if (first === 'c' && isCollection(c)) return rest ? { name: 'city', collection: c, world: rest } : { name: 'collection', collection: c };
  if (first === 'p' && isCollection(c) && rest) return { name: 'puzzle', collection: c, slug: rest };
  return { name: 'home' };
}

export function buildRoute(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'load':
      return '#/load';
    case 'collection':
      return `#/c/${r.collection}`;
    case 'city':
      return `#/c/${r.collection}/${encodeURIComponent(r.world)}`;
    case 'puzzle':
      return `#/p/${r.collection}/${encodeURIComponent(r.slug)}`;
  }
}
