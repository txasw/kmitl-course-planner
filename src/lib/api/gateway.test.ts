import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGateway } from './gateway';
import { createCacheStore } from './cache';
import { facultyEndpoint, type ReferenceEndpoint } from './endpoints';
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

const probeSchema = z.array(z.object({ id: z.string() }));

const probeEndpoint: ReferenceEndpoint<{ id: string }[]> = {
  endpoint: 'probe',
  url: 'https://api.example/probe',
  schema: probeSchema,
  ttlMs: 1000,
  cacheKey: 'kcp:cache:ref:probe',
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
      expect(result.value.courses.length).toBeGreaterThan(0);
      expect(result.value.duplicateCount).toBeGreaterThan(0);
    }
    await gateway.teachTable(ownerQuery);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
