import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from './http';
import type { GatewayEnv } from './types';

function makeEnv(
  fetchImpl: typeof fetch,
  sleep?: GatewayEnv['sleep'],
): GatewayEnv {
  return {
    fetch: fetchImpl,
    now: () => 0,
    random: () => 0.5,
    sleep: sleep ?? (() => Promise.resolve()),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchJson', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on the first attempt', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ hi: true }));
    const outcome = await fetchJson('https://x', makeEnv(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome.retryCount).toBe(0);
    expect(outcome.status).toBe(200);
    expect(outcome.result.ok).toBe(true);
    if (outcome.result.ok) {
      expect(outcome.result.value).toEqual({ hi: true });
    }
  });

  it('retries a 5xx response and then succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('e', { status: 500 }))
      .mockResolvedValueOnce(new Response('e', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const outcome = await fetchJson('https://x', makeEnv(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(outcome.retryCount).toBe(2);
    expect(outcome.result.ok).toBe(true);
  });

  it('does not retry a 4xx response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('bad', { status: 400 }));
    const outcome = await fetchJson('https://x', makeEnv(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome.retryCount).toBe(0);
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok && outcome.result.error.kind === 'http') {
      expect(outcome.result.error.status).toBe(400);
    } else {
      expect.unreachable('expected an http error');
    }
  });

  it('retries a network failure and surfaces a network error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('failed to fetch'));
    const outcome = await fetchJson('https://x', makeEnv(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(outcome.retryCount).toBe(2);
    expect(outcome.status).toBeNull();
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok) {
      expect(outcome.result.error.kind).toBe('network');
    }
  });

  it('maps an aborted request to a terminal timeout error', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const promise = fetchJson('https://x', makeEnv(fetchImpl));
    await vi.advanceTimersByTimeAsync(15_000);
    const outcome = await promise;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome.retryCount).toBe(0);
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok) {
      expect(outcome.result.error.kind).toBe('timeout');
    }
  });

  it('honours a raised per endpoint timeout', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const promise = fetchJson('https://x', makeEnv(fetchImpl), {
      timeoutMs: 45_000,
    });
    // The default budget passes without aborting the raised one.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    const outcome = await promise;
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok) {
      expect(outcome.result.error.kind).toBe('timeout');
    }
  });

  it('treats a non JSON body as a validation error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not json', { status: 200 }));
    const outcome = await fetchJson('https://x', makeEnv(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok) {
      expect(outcome.result.error.kind).toBe('validation');
    }
  });

  it('backs off with full jitter between retries', async () => {
    const sleep = vi
      .fn<(ms: number) => Promise<void>>()
      .mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('e', { status: 500 }));
    const env: GatewayEnv = {
      fetch: fetchImpl,
      now: () => 0,
      random: () => 1,
      sleep,
    };
    await fetchJson('https://x', env);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 300);
    expect(sleep).toHaveBeenNthCalledWith(2, 600);
  });
});
