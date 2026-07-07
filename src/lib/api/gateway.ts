// The gateway is the single network and cache authority. For each request it runs
// cache lookup, then coalesces identical in flight calls, then the pipeline of
// simulation, fetch with retry, audit, Zod validation, and (for teach table)
// normalization. Production registers no interceptors, so the simulation, audit,
// and recorder calls are cheap no-ops. The audit runs on the raw payload before
// validation so the diagnostics report captures drift even when it also breaks the
// hard gate. Reference responses return the validated raw arrays; the teach table
// response is normalized after validation.

import type { z } from 'zod';
import { ok, type Result } from '../utils/result';
import { validate } from '../domain/schemas';
import {
  normalizeTeachTable,
  type NormalizedCatalog,
} from '../domain/normalize';
import type { TeachTableQuery } from '../messaging/protocol';
import type { CacheStore } from './cache';
import { fetchJson, type HttpOutcome } from './http';
import {
  teachTableCacheKey,
  teachTableEndpoint,
  teachTableParams,
  teachTableUrl,
  type ReferenceEndpoint,
} from './endpoints';
import { getAudit, getRecorder, getSimulation } from './interceptors';
import type { FaultOutcome, GatewayEnv, RequestContext } from './types';

export interface GatewayDeps {
  cache: CacheStore;
  env: GatewayEnv;
}

export interface Gateway {
  reference<T>(
    endpoint: ReferenceEndpoint<T>,
    refresh?: boolean,
  ): Promise<Result<T>>;
  teachTable(
    query: TeachTableQuery,
    refresh?: boolean,
  ): Promise<Result<NormalizedCatalog>>;
}

interface LogMetrics {
  cacheHit: boolean;
  status: number | null;
  retryCount: number;
  durationMs: number;
}

/** Wrap the env with a fetch that emulates a simulated fault. */
function withFault(env: GatewayEnv, fault: FaultOutcome): GatewayEnv {
  if (fault.kind === 'latency') {
    return {
      ...env,
      fetch: async (input, init) => {
        await env.sleep(fault.ms);
        return env.fetch(input, init);
      },
    };
  }
  const faultFetch: typeof fetch = () => {
    switch (fault.kind) {
      case 'network':
        return Promise.reject(new TypeError('simulated network error'));
      case 'timeout': {
        // An AbortError named error reproduces what our own timeout throws, so
        // the http client maps it to a timeout without waiting the full budget.
        const abort = new Error('simulated timeout');
        abort.name = 'AbortError';
        return Promise.reject(abort);
      }
      case 'http':
        return Promise.resolve(
          new Response('simulated', { status: fault.status }),
        );
    }
  };
  return { ...env, fetch: faultFetch };
}

export function createGateway(deps: GatewayDeps): Gateway {
  const { cache, env } = deps;
  const inFlight = new Map<string, Promise<Result<unknown>>>();

  function record(context: RequestContext, metrics: LogMetrics): void {
    getRecorder()?.record({
      endpoint: context.endpoint,
      params: context.params,
      cacheHit: metrics.cacheHit,
      status: metrics.status,
      retryCount: metrics.retryCount,
      durationMs: metrics.durationMs,
      // The debug recorder enriches this from the latest audit report.
      issueCount: 0,
    });
  }

  async function runFetch(context: RequestContext): Promise<HttpOutcome> {
    const directive = getSimulation()?.intercept(context) ?? null;
    if (directive?.kind === 'fixture') {
      return { result: ok(directive.response), status: 200, retryCount: 0 };
    }
    if (directive?.kind === 'fault') {
      return fetchJson(context.url, withFault(env, directive.fault));
    }
    const outcome = await fetchJson(context.url, env);
    if (directive?.kind === 'mutate' && outcome.result.ok) {
      return { ...outcome, result: ok(directive.mutate(outcome.result.value)) };
    }
    return outcome;
  }

  async function doLoad<T>(
    context: RequestContext,
    cacheKey: string,
    ttlMs: number,
    refresh: boolean,
    schema: z.ZodType<T>,
  ): Promise<Result<T>> {
    if (!refresh) {
      const hit = await cache.get(cacheKey, env.now());
      if (hit) {
        record(context, {
          cacheHit: true,
          status: null,
          retryCount: 0,
          durationMs: 0,
        });
        // A memory hit was validated before it was cached, so it is trusted. A
        // storage hit crosses a trust boundary and is re-validated.
        return hit.source === 'memory'
          ? ok(hit.value as T)
          : validate(schema, hit.value);
      }
    }
    const start = env.now();
    const fetched = await runFetch(context);
    if (fetched.result.ok) {
      getAudit()?.observe(context, fetched.result.value);
    }
    const metrics: LogMetrics = {
      cacheHit: false,
      status: fetched.status,
      retryCount: fetched.retryCount,
      durationMs: env.now() - start,
    };
    record(context, metrics);
    if (!fetched.result.ok) {
      return fetched.result;
    }
    const validated = validate(schema, fetched.result.value);
    if (!validated.ok) {
      return validated;
    }
    await cache.set(cacheKey, validated.value, env.now() + ttlMs);
    return validated;
  }

  function load<T>(
    context: RequestContext,
    cacheKey: string,
    ttlMs: number,
    refresh: boolean,
    schema: z.ZodType<T>,
  ): Promise<Result<T>> {
    const existing = inFlight.get(cacheKey);
    if (existing) {
      return existing.then((shared) => shared as Result<T>);
    }
    const promise = doLoad(context, cacheKey, ttlMs, refresh, schema);
    inFlight.set(cacheKey, promise);
    return promise.finally(() => {
      inFlight.delete(cacheKey);
    });
  }

  return {
    reference(endpoint, refresh = false) {
      const context: RequestContext = {
        endpoint: endpoint.endpoint,
        params: {},
        url: endpoint.url,
      };
      return load(
        context,
        endpoint.cacheKey,
        endpoint.ttlMs,
        refresh,
        endpoint.schema,
      );
    },
    async teachTable(query, refresh = false) {
      const context: RequestContext = {
        endpoint: teachTableEndpoint.endpoint,
        params: teachTableParams(query),
        url: teachTableUrl(query),
      };
      const validated = await load(
        context,
        teachTableCacheKey(query),
        teachTableEndpoint.ttlMs,
        refresh,
        teachTableEndpoint.schema,
      );
      if (!validated.ok) {
        return validated;
      }
      return normalizeTeachTable(validated.value);
    },
  };
}

/** The production environment: real fetch, clock, randomness, and delay. */
export function createDefaultEnv(): GatewayEnv {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    now: () => Date.now(),
    random: () => Math.random(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
