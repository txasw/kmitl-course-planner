import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGateway } from './gateway';
import { createCacheStore } from './cache';
import {
  currentTermEndpoint,
  facultyEndpoint,
  type ReferenceEndpoint,
} from './endpoints';
import {
  resetInterceptors,
  setAudit,
  setRecorder,
  setSimulation,
} from './interceptors';
import type { GatewayEnv, RequestLogEntry } from './types';
import type { StorageAdapter } from '../storage/repo';
import { REFERENCE_TTL_MS, TEACH_TABLE_TTL_MS } from '../storage/keys';
import type { TeachTableQuery } from '../messaging/protocol';
import { loadFixture } from '../../../tests/support/fixtures';

vi.mock('../utils/logger', () => ({
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

const probeSchema = z.array(z.object({ id: z.string() }));

const probeEndpoint: ReferenceEndpoint<{ id: string }[]> = {
  endpoint: 'probe',
  url: 'https://api.example/probe',
  schema: probeSchema,
  ttlMs: 1000,
  cacheKey: 'kcp:cache:ref:probe',
  timeoutMs: 15_000,
};

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

function fakeAdapter(): StorageAdapter {
  const store = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

function newCache() {
  return createCacheStore(fakeAdapter());
}

function makeEnv(
  fetchImpl: typeof fetch,
  now: () => number = () => 0,
): GatewayEnv {
  return {
    fetch: fetchImpl,
    now,
    random: () => 0.5,
    sleep: () => Promise.resolve(),
  };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('createGateway', () => {
  afterEach(() => {
    resetInterceptors();
  });

  it('coalesces identical in flight requests into one fetch', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const [first, second] = await Promise.all([
      gateway.reference(probeEndpoint),
      gateway.reference(probeEndpoint),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
  });

  it('narrows a coalesced value through the joining caller schema', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    // Same cache key, stricter schema: the joiner must not receive the value the
    // first caller's schema accepted without checking it against its own.
    const strictEndpoint: ReferenceEndpoint<{ id: 'b' }[]> = {
      ...probeEndpoint,
      schema: z.array(z.object({ id: z.literal('b') })),
    };
    const [first, second] = await Promise.all([
      gateway.reference(probeEndpoint),
      gateway.reference(strictEndpoint),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ok: true, value: [{ id: 'a' }] });
    expect(second).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('narrows a memory cache hit through the schema', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const cache = newCache();
    await cache.set(probeEndpoint.cacheKey, [{ id: 1 }], {
      fetchedAt: 0,
      expiresAt: 1000,
    });
    const gateway = createGateway({ cache, env: makeEnv(fetchImpl) });
    const result = await gateway.reference(probeEndpoint);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('serves the second call from cache without refetching', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    await gateway.reference(probeEndpoint);
    await gateway.reference(probeEndpoint);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when refresh is set', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    await gateway.reference(probeEndpoint);
    await gateway.reference(probeEndpoint, true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('honors the 24 hour reference ttl', async () => {
    const fixture = loadFixture('faculty.capture.json');
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(fixture));
    let clock = 0;
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl, () => clock),
    });
    await gateway.reference(facultyEndpoint);
    clock = REFERENCE_TTL_MS - 1;
    await gateway.reference(facultyEndpoint);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = REFERENCE_TTL_MS;
    await gateway.reference(facultyEndpoint);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('serves from the storage tier after a worker restart', async () => {
    const adapter = fakeAdapter();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const first = createGateway({
      cache: createCacheStore(adapter),
      env: makeEnv(fetchImpl),
    });
    await first.reference(probeEndpoint);
    const revived = createGateway({
      cache: createCacheStore(adapter),
      env: makeEnv(fetchImpl),
    });
    await revived.reference(probeEndpoint);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('surfaces a schema mismatch as a validation error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ notId: 1 }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const result = await gateway.reference(probeEndpoint);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });

  it('records a log entry and audits a fresh fetch', async () => {
    const entries: RequestLogEntry[] = [];
    setRecorder({
      record: (entry) => {
        entries.push(entry);
      },
    });
    const observe = vi.fn();
    setAudit({ observe });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse([{ id: 'a' }]));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    await gateway.reference(probeEndpoint);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.cacheHit).toBe(false);
    expect(entries[0]?.status).toBe(200);
    expect(observe).toHaveBeenCalledOnce();
  });

  it('serves a simulation fixture without fetching', async () => {
    setSimulation({
      intercept: () => ({ kind: 'fixture', response: [{ id: 'fix' }] }),
    });
    const fetchImpl = vi.fn<typeof fetch>();
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const result = await gateway.reference(probeEndpoint);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ id: 'fix' }]);
    }
  });

  it('normalizes a teach table response and caches it', async () => {
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(fixture));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const result = await gateway.teachTable(ownerQuery);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.catalog.courses.length).toBeGreaterThan(0);
      expect(result.value.catalog.duplicateCount).toBeGreaterThan(0);
    }
    await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the fetch time and keeps it on a cache hit', async () => {
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    // A fresh response per call, since a body can be read only once.
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(okResponse(fixture)));
    let clock = 1_000;
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl, () => clock),
    });
    const fresh = await gateway.teachTable(ownerQuery);
    expect(fresh.ok && fresh.value.fetchedAt).toBe(1_000);
    // A hit reports when its data was fetched, not when it was read.
    clock = 61_000;
    const hit = await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(hit.ok && hit.value.fetchedAt).toBe(1_000);
    // A refresh fetches again and reports the new time.
    const refreshed = await gateway.teachTable(ownerQuery, true);
    expect(refreshed.ok && refreshed.value.fetchedAt).toBe(61_000);
  });

  it('keeps the fetch time of a storage hit after a worker restart', async () => {
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(fixture));
    const adapter = fakeAdapter();
    let clock = 5_000;
    const env = makeEnv(fetchImpl, () => clock);
    await createGateway({ cache: createCacheStore(adapter), env }).teachTable(
      ownerQuery,
    );
    clock = 65_000;
    // A fresh cache over the same storage models a respawned worker.
    const revived = createGateway({ cache: createCacheStore(adapter), env });
    const hit = await revived.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(hit.ok && hit.value.fetchedAt).toBe(5_000);
  });

  it('cancels an in flight teach table query so a retry re-fetches', async () => {
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const abort = () => {
              reject(new DOMException('Aborted', 'AbortError'));
            };
            // Real fetch rejects at once for an already aborted signal, which happens
            // when the cancel lands before the fetch starts.
            if (init?.signal?.aborted) {
              abort();
              return;
            }
            init?.signal?.addEventListener('abort', abort);
          }),
      )
      .mockResolvedValue(okResponse(fixture));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });

    const inflight = gateway.teachTable(ownerQuery);
    gateway.cancelTeachTable(ownerQuery);
    const canceled = await inflight;
    expect(canceled.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // The cancel cleared the coalescing slot, so a fresh call re-fetches.
    const retried = await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(retried.ok).toBe(true);
  });

  it('honors the 10 minute teach table ttl', async () => {
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(fixture));
    let clock = 0;
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl, () => clock),
    });
    await gateway.teachTable(ownerQuery);
    clock = TEACH_TABLE_TTL_MS - 1;
    await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = TEACH_TABLE_TTL_MS;
    await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('current term route', () => {
  const capture = loadFixture('year-semester-now.capture.json');

  it('fetches the regis endpoint once and serves repeats from cache', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(capture));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const first = await gateway.reference(currentTermEndpoint);
    const second = await gateway.reference(currentTermEndpoint);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(currentTermEndpoint.url);
    expect(first).toEqual(second);
    expect(first.ok && first.value.SEMESTER).toBe('1');
  });

  it('re-validates a storage hit after a worker restart', async () => {
    const adapter = fakeAdapter();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse(capture));
    await createGateway({
      cache: createCacheStore(adapter),
      env: makeEnv(fetchImpl),
    }).reference(currentTermEndpoint);
    const revived = await createGateway({
      cache: createCacheStore(adapter),
      env: makeEnv(fetchImpl),
    }).reference(currentTermEndpoint);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(revived.ok && revived.value.YEAR).toBe('2569');
  });

  it('surfaces an out of range semester as a validation error, uncached', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse({ YEAR: '2569', SEMESTER: '9' }));
    const gateway = createGateway({
      cache: newCache(),
      env: makeEnv(fetchImpl),
    });
    const result = await gateway.reference(currentTermEndpoint);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
    await gateway.reference(currentTermEndpoint);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
