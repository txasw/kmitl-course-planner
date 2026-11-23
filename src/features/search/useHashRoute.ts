// The hash route listener. The host is a hash routed single page application that
// never reloads, so the content script listens for route changes to know the active
// route. The parsed teach table route seeds the search term; the launcher and overlay
// are route independent, so this only informs defaults.
//
// The host runs Vue Router in hash mode on pushState (ADR-0067), so its own navigation
// fires no hashchange, and popstate fires only on back and forward. A content script
// cannot hook the page's pushState, so two read only signals cover the rest: the
// Navigation API's currententrychange, which fires for a pushState from any world where
// the browser provides the API, and a mutation observer on the host document, since the
// router swaps the route view as it navigates. The observer runs alongside the Navigation
// API rather than only in its absence, so a browser that exposes the API without
// delivering its events to a content script still hears the host. One set of listeners
// serves every subscriber, and the observer reports only a hash that moved, so the host's
// own rendering never wakes a subscriber. Nothing here writes to the host. The hash is
// read sanitized (ADR-0075), so what a subscriber sees and what is held between
// signals is the route path and the teach table search fields, never anything else the
// address carries.

import { useSyncExternalStore } from 'react';
import {
  parseTeachTableRoute,
  type TeachTableRoute,
} from '@/lib/routing/parseTeachTableRoute';
import { readLocationHash } from '@/features/shell/hostLocation';

const NAVIGATION_EVENT = 'currententrychange';

const subscribers = new Set<() => void>();
let detach: (() => void) | null = null;
let seenHash = '';

function notifySubscribers(): void {
  seenHash = readLocationHash();
  for (const subscriber of [...subscribers]) subscriber();
}

function notifyIfHashMoved(): void {
  if (readLocationHash() !== seenHash) notifySubscribers();
}

function hostNavigation(): EventTarget | null {
  return 'navigation' in window ? window.navigation : null;
}

function attachRouteSignals(): () => void {
  seenHash = readLocationHash();
  window.addEventListener('hashchange', notifySubscribers);
  window.addEventListener('popstate', notifySubscribers);
  const navigation = hostNavigation();
  navigation?.addEventListener(NAVIGATION_EVENT, notifySubscribers);
  const observer = new MutationObserver(notifyIfHashMoved);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  return () => {
    window.removeEventListener('hashchange', notifySubscribers);
    window.removeEventListener('popstate', notifySubscribers);
    navigation?.removeEventListener(NAVIGATION_EVENT, notifySubscribers);
    observer.disconnect();
  };
}

/** Listens for a host route change, by whichever signal reports it first. */
export function subscribeHashRoute(onChange: () => void): () => void {
  // A wrapper of its own, so two subscriptions of one function stay two.
  const subscriber = (): void => {
    onChange();
  };
  subscribers.add(subscriber);
  detach ??= attachRouteSignals();
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && detach !== null) {
      detach();
      detach = null;
    }
  };
}

/** The current teach table result route, or null on any other route. */
export function useHashRoute(): TeachTableRoute | null {
  const hash = useSyncExternalStore(
    subscribeHashRoute,
    readLocationHash,
    readLocationHash,
  );
  return parseTeachTableRoute(hash);
}
