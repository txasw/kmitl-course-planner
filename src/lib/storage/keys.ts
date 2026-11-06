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

/**
 * Content owned last search state, one entry per search tab, persisted so the
 * form restores on reopen. Like the preferences key it is disjoint from the plan
 * root and the worker cache namespace, so it never touches the plan-store-only
 * persistence rule.
 */
export const SEARCH_KEY = 'kcp:search';

/**
 * Worker owned install record in storage.local, written once when the extension
 * is first installed and never overwritten. Content only reads it, so the two
 * sides never write the same key.
 */
export const INSTALL_KEY = 'kcp:install';

/**
 * Content owned onboarding record in storage.local: when the welcome showed, when
 * the panel first opened, and when the entry toast was turned off. The worker never
 * writes it.
 */
export const ONBOARDING_KEY = 'kcp:onboarding';

/**
 * Worker owned tab intents in storage.session, which content scripts cannot reach
 * by default. It records which tab the worker opened and why, so a content script
 * mounting in that tab can learn it through the mount handshake. The session area
 * clears when the browser restarts, which bounds a stale intent.
 */
export const TAB_INTENTS_KEY = 'kcp:session:tabIntents';

/** How long a recorded tab intent stays valid before it is ignored and pruned. */
export const TAB_INTENT_TTL_MS = 60 * 1000;

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
