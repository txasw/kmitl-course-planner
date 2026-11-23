// The one module that reads the host address (ADR-0075). The host can carry a token or
// a student id in its hash, so the rest of KCP never reads window.location; a lint rule
// holds every other module to that. It gets the hash already sanitized to the route
// path and the teach table search fields, and, where it must tell whether the address
// moved, an opaque marker: a digest of the full address under a seed drawn once per
// document, which can be compared but says nothing about the address it came from.

import { sanitizeHash } from '@/lib/routing/locationHash';
import { opaqueDigest } from '@/lib/utils/digest';

let seed: number | null = null;

function documentSeed(): number {
  seed ??= crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return seed;
}

/** The host location hash, sanitized to what KCP needs. */
export function readLocationHash(): string {
  return sanitizeHash(window.location.hash);
}

/** An opaque marker of the full host address, equal for equal addresses. */
export function readLocationMarker(): string {
  return opaqueDigest(window.location.href, documentSeed());
}
