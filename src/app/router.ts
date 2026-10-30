import type { Collection } from '../data/apk.ts';

/** Hash routes, so the app works from any static host and from the home screen. */

type CollectionId = Collection['id'];

export type Route =
  | { name: 'home' }
  | { name: 'load' }
  | { name: 'settings' }
  | { name: 'mine' }
  | { name: 'edit'; id: string }
  | { name: 'play'; id: string }
  | { name: 'shared'; payload: string }
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
  if (first === 'settings') return { name: 'settings' };
  if (first === 'mine') return { name: 'mine' };
  if (first === 'edit' && c) return { name: 'edit', id: c };
  if (first === 'play' && c) return { name: 'play', id: c };
  if (first === 's' && c) return { name: 'shared', payload: c };
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
    case 'settings':
      return '#/settings';
    case 'mine':
      return '#/mine';
    case 'edit':
      return `#/edit/${encodeURIComponent(r.id)}`;
    case 'play':
      return `#/play/${encodeURIComponent(r.id)}`;
    case 'shared':
      return `#/s/${r.payload}`;
    case 'collection':
      return `#/c/${r.collection}`;
    case 'city':
      return `#/c/${r.collection}/${encodeURIComponent(r.world)}`;
    case 'puzzle':
      return `#/p/${r.collection}/${encodeURIComponent(r.slug)}`;
  }
}

/**
 * Where a puzzle's Back goes: home if play started from the home screen, otherwise the
 * puzzle's own city (which may be a city Next has moved into since).
 */
export function puzzleBackRoute(lastList: Route | null, collection: CollectionId, world: string): Route {
  return lastList?.name === 'city' || lastList?.name === 'collection' ? { name: 'city', collection, world } : { name: 'home' };
}
