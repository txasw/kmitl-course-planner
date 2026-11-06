import { describe, expect, it } from 'vitest';
import {
  CACHE_PREFIX,
  INSTALL_KEY,
  ONBOARDING_KEY,
  PREFS_KEY,
  REFERENCE_TTL_MS,
  ROOT_KEY,
  SEARCH_KEY,
  TAB_INTENTS_KEY,
  TAB_INTENT_TTL_MS,
  TEACH_TABLE_TTL_MS,
  quarantineKey,
  refCacheKey,
  teachCacheKey,
} from './keys';

describe('cache keys', () => {
  it('namespaces reference and teach keys under the cache prefix', () => {
    expect(refCacheKey('faculty')).toBe('kcp:cache:ref:faculty');
    expect(teachCacheKey('abc123')).toBe('kcp:cache:teach:abc123');
    expect(refCacheKey('faculty').startsWith(CACHE_PREFIX)).toBe(true);
    expect(teachCacheKey('abc123').startsWith(CACHE_PREFIX)).toBe(true);
  });

  it('keeps the cache namespace disjoint from the plan root', () => {
    expect(refCacheKey('faculty').startsWith(ROOT_KEY)).toBe(false);
  });

  it('exposes the two ttl classes', () => {
    expect(REFERENCE_TTL_MS).toBe(86_400_000);
    expect(TEACH_TABLE_TTL_MS).toBe(600_000);
  });
});

describe('onboarding keys', () => {
  const recordKeys = [INSTALL_KEY, ONBOARDING_KEY, TAB_INTENTS_KEY];

  it('names the install, onboarding and tab intent records', () => {
    expect(INSTALL_KEY).toBe('kcp:install');
    expect(ONBOARDING_KEY).toBe('kcp:onboarding');
    expect(TAB_INTENTS_KEY).toBe('kcp:session:tabIntents');
  });

  it('keeps every record key disjoint from the existing keys', () => {
    const existing = [ROOT_KEY, PREFS_KEY, SEARCH_KEY];
    for (const key of recordKeys) {
      expect(existing).not.toContain(key);
      expect(key.startsWith(CACHE_PREFIX)).toBe(false);
      expect(key.startsWith(quarantineKey(''))).toBe(false);
    }
    expect(new Set(recordKeys).size).toBe(recordKeys.length);
  });

  it('expires a tab intent after one minute', () => {
    expect(TAB_INTENT_TTL_MS).toBe(60_000);
  });
});
