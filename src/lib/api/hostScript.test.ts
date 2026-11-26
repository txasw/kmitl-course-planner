import { describe, expect, it, vi } from 'vitest';
import {
  HOST_SCRIPT_MAX_BYTES,
  fetchHostScript,
  hostScriptUrl,
} from './hostScript';

const JS = { 'content-type': 'application/javascript; charset=utf-8' };

function envWith(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );
  return { fetch };
}

describe('hostScriptUrl', () => {
  it('builds the address on the host script folder from an app script name only', () => {
    expect(hostScriptUrl('app.0123abcd.js')).toBe(
      'https://regis.reg.kmitl.ac.th/js/app.0123abcd.js',
    );
    for (const name of [
      'chunk-vendors.0123abcd.js',
      'app.0123ABCD.js',
      'app.0123abc.js',
      '../app.0123abcd.js',
      'app.0123abcd.js?x=1',
      'https://evil.example/app.0123abcd.js',
    ]) {
      expect(hostScriptUrl(name), name).toBeNull();
    }
  });
});

describe('fetchHostScript', () => {
  it('reads the script with no cookie, no referrer, and no redirect', async () => {
    const env = envWith(new Response('var a=1;', { headers: JS }));
    expect(await fetchHostScript('app.0123abcd.js', env)).toEqual({
      kind: 'read',
      source: 'var a=1;',
    });
    const [url, init] = env.fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://regis.reg.kmitl.ac.th/js/app.0123abcd.js');
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  });

  it('fetches nothing for a name that is not an app script', async () => {
    const env = envWith(new Response('', { headers: JS }));
    expect(await fetchHostScript('app.js', env)).toEqual({
      kind: 'unreadable',
    });
    expect(env.fetch).not.toHaveBeenCalled();
  });

  it('keeps a script it will not read as unreadable', async () => {
    const tooLong = new Response('x', {
      headers: { ...JS, 'content-length': String(HOST_SCRIPT_MAX_BYTES + 1) },
    });
    expect(await fetchHostScript('app.0123abcd.js', envWith(tooLong))).toEqual({
      kind: 'unreadable',
    });
    const big = new Response(new Uint8Array(HOST_SCRIPT_MAX_BYTES + 1), {
      headers: JS,
    });
    expect(await fetchHostScript('app.0123abcd.js', envWith(big))).toEqual({
      kind: 'unreadable',
    });
    const notText = new Response(new Uint8Array([0xff, 0xfe, 0xfd]), {
      headers: JS,
    });
    expect(await fetchHostScript('app.0123abcd.js', envWith(notText))).toEqual({
      kind: 'unreadable',
    });
  });

  it('reads a request that did not complete as failed', async () => {
    for (const response of [
      new Response('', { status: 404, headers: JS }),
      new Response('<html></html>', {
        headers: { 'content-type': 'text/html' },
      }),
      new TypeError('network down'),
    ]) {
      expect(
        await fetchHostScript('app.0123abcd.js', envWith(response)),
      ).toEqual({ kind: 'failed' });
    }
  });

  it('gives up on a request that takes too long', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn<typeof globalThis.fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );
      const pending = fetchHostScript('app.0123abcd.js', { fetch });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await pending).toEqual({ kind: 'failed' });
    } finally {
      vi.useRealTimers();
    }
  });
});
