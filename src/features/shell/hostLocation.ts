// The one module that reads the host address (ADR-0075). The host can carry a token or
// a student id in its hash, so the rest of KCP never reads window.location; a lint rule
// holds every other module to that. It gets the hash already sanitized to the route
// path and the teach table search fields.

import { sanitizeHash } from '@/lib/routing/locationHash';

/** The host location hash, sanitized to what KCP needs. */
export function readLocationHash(): string {
  return sanitizeHash(window.location.hash);
}
