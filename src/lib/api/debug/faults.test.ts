import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DEBUG_CANARY, FAULT_PRESETS, findFault } from './faults';
import { createGateway } from '../gateway';
import { createCacheStore } from '../cache';
import { resetInterceptors, setSimulation } from '../interceptors';
import type { GatewayEnv } from '../types';
import type { ReferenceEndpoint } from '../endpoints';
import type { StorageAdapter } from '../../storage/repo';

const probeEndpoint: ReferenceEndpoint<{ id: string }[]> = {
  endpoint: 'probe',
  url: 'https://api.example/probe',
  schema: z.array(z.object({ id: z.string() })),
  ttlMs: 1000,
  cacheKey: 'kcp:cache:ref:probe',
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

function makeEnv(
  fetchImpl: typeof fetch,
  sleep: GatewayEnv['sleep'] = () => Promise.resolve(),
): GatewayEnv {
  return { fetch: fetchImpl, now: () => 0, random: () => 0.5, sleep };
}

const errorCases: { id: string; kind: string; status: number | null }[] = [
  { id: 'network_error', kind: 'network', status: null },
  { id: 'timeout', kind: 'timeout', status: null },
  { id: 'http_400', kind: 'http', status: 400 },
  { id: 'http_403', kind: 'http', status: 403 },
  { id: 'http_500', kind: 'http', status: 500 },
  { id: 'http_503', kind: 'http', status: 503 },
];

describe('fault presets', () => {
  afterEach(() => {
    resetInterceptors();
  });

  it('embeds the debug canary and the documented fault ids', () => {
    expect(DEBUG_CANARY).toBe('kcp-debug-canary');
    expect(FAULT_PRESETS.map((preset) => preset.id)).toEqual([
      'network_error',
      'timeout',
      'http_400',
      'http_403',
      'http_500',
      'http_503',
      'added_latency',
    ]);
  });

  it.each(errorCases)(
    'maps the $id fault to a $kind error through the gateway',
    async ({ id, kind, status }) => {
      const preset = findFault(id);
      if (!preset) {
        expect.unreachable('missing preset');
        return;
      }
      setSimulation({
        intercept: () => ({ kind: 'fault', fault: preset.outcome }),
      });
      const gateway = createGateway({
        cache: createCacheStore(fakeAdapter()),
        env: makeEnv(vi.fn<typeof fetch>()),
      });
      const result = await gateway.reference(probeEndpoint);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe(kind);
        if (status !== null && result.error.kind === 'http') {
          expect(result.error.status).toBe(status);
        }
      }
    },
  );

  it('adds latency and then completes the underlying request', async () => {
    const preset = findFault('added_latency');
    if (!preset) {
      expect.unreachable('missing preset');
      return;
    }
    expect(preset.outcome).toEqual({ kind: 'latency', ms: 5000 });
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSimulation({
      intercept: () => ({ kind: 'fault', fault: preset.outcome }),
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: 'a' }]), { status: 200 }),
      );
    const gateway = createGateway({
      cache: createCacheStore(fakeAdapter()),
      env: makeEnv(fetchImpl, sleep),
    });
    const result = await gateway.reference(probeEndpoint);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it('returns undefined for an unknown fault id', () => {
    expect(findFault('nope')).toBeUndefined();
  });
});
