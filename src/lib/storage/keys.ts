// Storage keys, cache keys, and the current schema version. All persisted plan
// data lives under a single versioned root key so a migration runner can reason
// about the whole blob at once. Corrupt blobs are moved aside under a timestamped
// quarantine key. The worker owned response cache lives under a distinct
// kcp:cache: namespace so it never collides with the content owned plan root, per
// the write ownership split.

/** The single root key holding the persisted plan data. */
export const ROOT_KEY = 'kcp:v1';

/** The schema version the current build reads and writes. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Content owned UI preferences such as the language choice. These live under a
 * separate key rather than the plan root so the plan store binding stays
 * deferred and the plan-store-only persistence rule holds. It is disjoint from
 * both the plan root and the worker owned kcp:cache: namespace.
 */
export const PREFS_KEY = 'kcp:prefs';

/** Key under which a corrupt root blob is preserved for later export. */
export function quarantineKey(timestamp: string): string {
  return `kcp:quarantine:${timestamp}`;
}

/** Namespace prefix for every worker owned response cache entry. */
export const CACHE_PREFIX = 'kcp:cache:';

/** Cache key for a reference endpoint, which has no per request parameters. */
export function refCacheKey(name: string): string {
  return `${CACHE_PREFIX}ref:${name}`;
}

/** Cache key for a teach table result, keyed by a hash of its full query. */
export function teachCacheKey(hash: string): string {
  return `${CACHE_PREFIX}teach:${hash}`;
}

/** Reference data changes rarely, so it is cached for a full day. */
export const REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

/** Teach table results change during registration, so they cache briefly. */
export const TEACH_TABLE_TTL_MS = 10 * 60 * 1000;
