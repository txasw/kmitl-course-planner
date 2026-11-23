// Whether the host page on screen is a registration page, where KCP keeps quiet
// (ADR-0075). The automatic triggers read it once when they would start a request, and
// the panel subscribes to it so the busy notice follows a host navigation.

import { useSyncExternalStore } from 'react';
import { isRegistrationRoute } from '@/lib/regis/route';
import {
  readLocationHash,
  subscribeHashRoute,
} from '@/features/search/useHashRoute';

/** Whether the current host route is a registration page. */
export function isQuietRoute(): boolean {
  return isRegistrationRoute(readLocationHash());
}

/** The quiet state of the current host route, kept current across host navigation. */
export function useQuietRoute(): boolean {
  return useSyncExternalStore(subscribeHashRoute, isQuietRoute, isQuietRoute);
}
