// The hash route listener. The host is a hash routed single page application that
// never reloads, so the content script reacts to hashchange and popstate to know
// the active route. The parsed teach table route seeds the search term; the
// launcher and overlay are route independent, so this only informs defaults.

import { useSyncExternalStore } from 'react';
import {
  parseTeachTableRoute,
  type TeachTableRoute,
} from '@/lib/routing/parseTeachTableRoute';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

function getHash(): string {
  return window.location.hash;
}

/** The current teach table result route, or null on any other route. */
export function useHashRoute(): TeachTableRoute | null {
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  return parseTeachTableRoute(hash);
}
