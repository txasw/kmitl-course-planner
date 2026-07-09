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

export interface HttpOutcome {
  result: Result<unknown>;
  /** HTTP status of the final attempt, or null when no response was received. */
  status: number | null;
  retryCount: number;
}

interface Attempt {
  retryable: boolean;
  status: number | null;
  result: Result<unknown>;
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

async function attemptOnce(
  url: string,
  env: GatewayEnv,
  timeoutMs: number,
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await env.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = `request failed with status ${String(response.status)}`;
      return {
        retryable: response.status >= 500,
        status: response.status,
        result: err(httpError(response.status, message)),
      };
    }
    try {
      const data: unknown = await response.json();
      return { retryable: false, status: response.status, result: ok(data) };
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
      };
    }
    return {
      retryable: true,
      status: null,
      result: err(networkError(messageOf(error))),
    };
  } finally {
    clearTimeout(timer);
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
    const attemptResult = await attemptOnce(url, env, timeoutMs);
    const exhausted = attempt >= maxRetries;
    if (!attemptResult.retryable || exhausted) {
      return {
        result: attemptResult.result,
        status: attemptResult.status,
        retryCount: attempt,
      };
    }
    await env.sleep(backoffDelay(attempt, env));
  }
}
