// The single fetch path for the gateway. It applies a per attempt timeout via
// AbortController and retries only transient failures (network errors and 5xx),
// never a 4xx or a timeout, with full jitter exponential backoff. The clock,
// randomness, delay, and fetch are all taken from the injected GatewayEnv so the
// retry and timeout behaviour is deterministic under test.

import {
  err,
  httpError,
  networkError,
  ok,
  timeoutError,
  validationError,
  type Result,
} from '../utils/result';
import type { GatewayEnv } from './types';

/** Default per attempt timeout, used when an endpoint does not set its own. */
export const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 300;
const BACKOFF_CAP_MS = 4_000;

/**
 * A breakdown of where a fetch attempt spent its time, so the debug request log can
 * show whether a slow query is network bound or client bound. Time to first byte is
 * until the response headers arrive; download is reading the body; parse is JSON.parse
 * of that body. All zero when no response was received.
 */
export interface HttpTimings {
  ttfbMs: number;
  downloadMs: number;
  parseMs: number;
  payloadBytes: number;
}

/** The zero timings for a request that received no response. */
export const NO_TIMINGS: HttpTimings = {
  ttfbMs: 0,
  downloadMs: 0,
  parseMs: 0,
  payloadBytes: 0,
};

export interface HttpOutcome {
  result: Result<unknown>;
  /** HTTP status of the final attempt, or null when no response was received. */
  status: number | null;
  retryCount: number;
  /** The final attempt's phase timings. */
  timings: HttpTimings;
}

interface Attempt {
  retryable: boolean;
  status: number | null;
  result: Result<unknown>;
  timings: HttpTimings;
}

/** The response body size in bytes from the header, or the text length as a fallback. */
function payloadSize(response: Response, text: string): number {
  const header = Number(response.headers.get('content-length'));
  return Number.isFinite(header) && header > 0 ? header : text.length;
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as Record<string, unknown>).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'network request failed';
}

/**
 * Extract a `{ message: { field: string[] } }` validation body into a field error
 * map, or undefined when the body is missing, not JSON, or not that shape. The
 * registration API returns this for a rejected query, for example
 * `{ "message": { "selected_subject_id": ["length is not equal 8"] } }`.
 */
function extractFieldErrors(
  text: string,
): Record<string, string[]> | undefined {
  if (text === '') {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const message = (parsed as Record<string, unknown>).message;
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(message)) {
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      fields[key] = value;
    }
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

async function attemptOnce(
  url: string,
  env: GatewayEnv,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  // A cancel from the UI arrives as an external signal; forward it to the same
  // controller so the fetch aborts, mapped to a terminal error like the timeout.
  const onExternalAbort = () => {
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }
  const start = env.now();
  try {
    const response = await env.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const ttfbMs = env.now() - start;
    if (!response.ok) {
      const message = `request failed with status ${String(response.status)}`;
      // Read the error body once (a 4xx or 5xx is terminal after retries, never
      // parsed for data) to surface a server field error such as the subject id
      // length rejection. Best effort: a missing or non JSON body yields no detail.
      const fields = extractFieldErrors(await response.text().catch(() => ''));
      return {
        retryable: response.status >= 500,
        status: response.status,
        result: err(httpError(response.status, message, fields)),
        timings: { ...NO_TIMINGS, ttfbMs },
      };
    }
    // Read then parse the body separately so download and parse time are distinct and
    // the payload size is known; response.json() would fuse them. Both stay inside the
    // try so a body read or parse failure is a terminal validation error, not a
    // retryable network error.
    try {
      const downloadStart = env.now();
      const text = await response.text();
      const downloadMs = env.now() - downloadStart;
      const payloadBytes = payloadSize(response, text);
      const parseStart = env.now();
      const data: unknown = JSON.parse(text);
      return {
        retryable: false,
        status: response.status,
        result: ok(data),
        timings: {
          ttfbMs,
          downloadMs,
          parseMs: env.now() - parseStart,
          payloadBytes,
        },
      };
    } catch {
      return {
        retryable: false,
        status: response.status,
        result: err(
          validationError(
            [{ path: '', message: 'response body was not valid json' }],
            'response body was not valid json',
          ),
        ),
        timings: { ...NO_TIMINGS, ttfbMs },
      };
    }
  } catch (error) {
    // Our own timeout aborts the request, which surfaces as an AbortError. It is
    // terminal: the attempt already spent the full budget, so retrying it only
    // compounds the wait.
    if (errorName(error) === 'AbortError') {
      return {
        retryable: false,
        status: null,
        result: err(timeoutError('request timed out')),
        timings: NO_TIMINGS,
      };
    }
    return {
      retryable: true,
      status: null,
      result: err(networkError(messageOf(error))),
      timings: NO_TIMINGS,
    };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function backoffDelay(attempt: number, env: GatewayEnv): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return env.random() * ceiling;
}

export interface FetchOptions {
  /** Retries for a transient failure. Defaults to two. */
  maxRetries?: number;
  /** Per attempt timeout. Defaults to DEFAULT_TIMEOUT_MS; the teach table endpoint
   * raises it because its large category payloads take longer than reference data. */
  timeoutMs?: number;
  /** An external signal that aborts the request, for a UI cancel. */
  signal?: AbortSignal;
}

/**
 * Fetch a URL as JSON. Retries network failures and 5xx responses up to
 * maxRetries times; a 4xx, a timeout, or a non JSON body is returned as is.
 */
export async function fetchJson(
  url: string,
  env: GatewayEnv,
  options: FetchOptions = {},
): Promise<HttpOutcome> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (let attempt = 0; ; attempt += 1) {
    const attemptResult = await attemptOnce(
      url,
      env,
      timeoutMs,
      options.signal,
    );
    const exhausted = attempt >= maxRetries;
    if (!attemptResult.retryable || exhausted) {
      return {
        result: attemptResult.result,
        status: attemptResult.status,
        retryCount: attempt,
        timings: attemptResult.timings,
      };
    }
    await env.sleep(backoffDelay(attempt, env));
  }
}
