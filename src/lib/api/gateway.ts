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
import { fetchJson, type HttpOutcome, type HttpTimings } from './http';
import {
  teachTableCacheKey,
  teachTableEndpoint,
  teachTableParams,
  teachTableUrl,
  type ReferenceEndpoint,
} from './endpoints';
import { getAudit, getRecorder, getSimulation } from './interceptors';
import type { FaultOutcome, GatewayEnv, RequestContext } from './types';
import { logger } from '../utils/logger';

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
  /** Abort an in flight teach table query so the UI can cancel a slow one. */
  cancelTeachTable(query: TeachTableQuery): void;
}

interface LogMetrics {
  cacheHit: boolean;
  status: number | null;
  retryCount: number;
  durationMs: number;
  timings: HttpTimings;
  validateMs: number;
}

const NO_TIMINGS: HttpTimings = {
  ttfbMs: 0,
  downloadMs: 0,
  parseMs: 0,
  payloadBytes: 0,
};

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
  const aborts = new Map<string, AbortController>();

  function record(context: RequestContext, metrics: LogMetrics): void {
    getRecorder()?.record({
      endpoint: context.endpoint,
      params: context.params,
      cacheHit: metrics.cacheHit,
      status: metrics.status,
      retryCount: metrics.retryCount,
      durationMs: metrics.durationMs,
      ttfbMs: metrics.timings.ttfbMs,
      downloadMs: metrics.timings.downloadMs,
      parseMs: metrics.timings.parseMs,
      validateMs: metrics.validateMs,
      payloadBytes: metrics.timings.payloadBytes,
      // The debug recorder enriches this from the latest audit report.
      issueCount: 0,
    });
  }

  async function runFetch(
    context: RequestContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const directive = getSimulation()?.intercept(context) ?? null;
    if (directive?.kind === 'fixture') {
      return {
        result: ok(directive.response),
        status: 200,
        retryCount: 0,
        timings: NO_TIMINGS,
      };
    }
    const fetchOptions = { timeoutMs: context.timeoutMs, signal };
    if (directive?.kind === 'fault') {
      return fetchJson(
        context.url,
        withFault(env, directive.fault),
        fetchOptions,
      );
    }
    const outcome = await fetchJson(context.url, env, fetchOptions);
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
    signal: AbortSignal,
  ): Promise<Result<T>> {
    if (!refresh) {
      const hit = await cache.get(cacheKey, env.now());
      if (hit) {
        logger.debug('cache hit', context.endpoint, hit.source);
        record(context, {
          cacheHit: true,
          status: null,
          retryCount: 0,
          durationMs: 0,
          timings: NO_TIMINGS,
          validateMs: 0,
        });
        // A memory hit was validated before it was cached, so it is trusted. A
        // storage hit crosses a trust boundary and is re-validated.
        return hit.source === 'memory'
          ? ok(hit.value as T)
          : validate(schema, hit.value);
      }
    }
    const start = env.now();
    const fetched = await runFetch(context, signal);
    const fetchMs = env.now() - start;
    if (!fetched.result.ok) {
      record(context, {
        cacheHit: false,
        status: fetched.status,
        retryCount: fetched.retryCount,
        durationMs: fetchMs,
        timings: fetched.timings,
        validateMs: 0,
      });
      logger.warn(
        'request failed',
        context.endpoint,
        fetched.result.error.kind,
      );
      return fetched.result;
    }
    getAudit()?.observe(context, fetched.result.value);
    const validateStart = env.now();
    const validated = validate(schema, fetched.result.value);
    const validateMs = env.now() - validateStart;
    record(context, {
      cacheHit: false,
      status: fetched.status,
      retryCount: fetched.retryCount,
      durationMs: fetchMs,
      timings: fetched.timings,
      validateMs,
    });
    if (!validated.ok) {
      logger.warn('response failed validation', context.endpoint);
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
    // One abort controller per in flight request, keyed like the coalescing map, so
    // a cancel can abort the shared request every coalesced caller is waiting on.
    const controller = new AbortController();
    aborts.set(cacheKey, controller);
    const promise = doLoad(
      context,
      cacheKey,
      ttlMs,
      refresh,
      schema,
      controller.signal,
    );
    inFlight.set(cacheKey, promise);
    return promise.finally(() => {
      // A cancel already cleared these and may have started a fresh request, so only
      // clear the entries still pointing at this promise.
      if (inFlight.get(cacheKey) === promise) {
        inFlight.delete(cacheKey);
        aborts.delete(cacheKey);
      }
    });
  }

  /** Abort an in flight request and drop its slots so a retry starts fresh. */
  function cancel(cacheKey: string): void {
    aborts.get(cacheKey)?.abort();
    inFlight.delete(cacheKey);
    aborts.delete(cacheKey);
  }

  return {
    reference(endpoint, refresh = false) {
      const context: RequestContext = {
        endpoint: endpoint.endpoint,
        params: {},
        url: endpoint.url,
        timeoutMs: endpoint.timeoutMs,
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
        timeoutMs: teachTableEndpoint.timeoutMs,
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
    cancelTeachTable(query) {
      cancel(teachTableCacheKey(query));
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
