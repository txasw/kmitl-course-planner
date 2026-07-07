import { describe, expect, it } from 'vitest';
import {
  CACHE_PREFIX,
  REFERENCE_TTL_MS,
  ROOT_KEY,
  TEACH_TABLE_TTL_MS,
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
