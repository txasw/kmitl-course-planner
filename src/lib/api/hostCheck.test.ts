import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import { createHostCheckRepository } from '../storage/hostChecks';
import { REPLICA_BUILD } from './debug/replicaBuild';
import { HOST_CHECK_RETRY_MS, createHostCheck } from './hostCheck';

const REPLICA = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/host-fingerprint/app.replica.js'),
  'utf8',
);
// A script body the mocked reader faults on, as a bug in the reader would.
const READER_FAULT = 'kcp reader fault';

vi.mock('../regis/fingerprint/fingerprint', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../regis/fingerprint/fingerprint')>();
  return {
    ...actual,
    fingerprintScript: (source: string) =>
      source === 'kcp reader fault'
        ? Promise.reject(new RangeError('reader fault'))
        : actual.fingerprintScript(source),
  };
});

const VENDORS = 'chunk-vendors.7ab4925e.js';
const NEW_APP = 'app.c0ffee01.js';
const JS = { 'content-type': 'text/javascript' };

function setup(body: string | Error = REPLICA) {
  let now = 1_000;
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    body instanceof Error
      ? Promise.reject(body)
      : Promise.resolve(new Response(body, { headers: JS })),
  );
  const storage = createMemoryStorage();
  const check = createHostCheck({
    env: { fetch, now: () => now },
    repo: createHostCheckRepository(storage),
    recorded: () => [REPLICA_BUILD],
  });
  return {
    check,
    fetch,
    storage,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('the host check', () => {
  it('trusts an exact tested pair without a request', async () => {
    const { check, fetch } = setup();
    expect(
      await check.check({ app: 'app.ba450963.js', vendors: VENDORS }),
    ).toEqual({ status: 'tested' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps an untested vendor script off without a request', async () => {
    const { check, fetch } = setup();
    expect(
      await check.check({ app: NEW_APP, vendors: 'chunk-vendors.00000000.js' }),
    ).toEqual({ status: 'untestedVendor' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses names that are not the two script patterns', async () => {
    const { check, fetch } = setup();
    expect(
      await check.check({ app: '../app.c0ffee01.js', vendors: VENDORS }),
    ).toEqual({ status: 'unreadable' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('verifies a new app script whose parts match a recorded build, once per name', async () => {
    const { check, fetch } = setup();
    const pair = { app: NEW_APP, vendors: VENDORS };
    const [first, second] = await Promise.all([
      check.check(pair),
      check.check(pair),
    ]);
    expect(first).toEqual({ status: 'verified' });
    expect(second).toEqual({ status: 'verified' });
    expect(await check.check(pair)).toEqual({ status: 'verified' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://regis.reg.kmitl.ac.th/js/app.c0ffee01.js',
    );
  });

  it('reads a kept fingerprint in a new worker without a request', async () => {
    const first = setup();
    await first.check.check({ app: NEW_APP, vendors: VENDORS });
    const fetch = vi.fn<typeof globalThis.fetch>();
    const again = createHostCheck({
      env: { fetch, now: () => 2_000 },
      repo: createHostCheckRepository(first.storage),
      recorded: () => [REPLICA_BUILD],
    });
    expect(await again.check({ app: NEW_APP, vendors: VENDORS })).toEqual({
      status: 'verified',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('names the parts that differ and keeps the mismatch', async () => {
    const changed = REPLICA.replace(
      'continuous:"Continue"',
      'continuous:"Next"',
    );
    const { check, fetch } = setup(changed);
    const pair = { app: NEW_APP, vendors: VENDORS };
    expect(await check.check(pair)).toEqual({
      status: 'mismatch',
      parts: ['labels'],
    });
    expect(await check.check(pair)).toEqual({
      status: 'mismatch',
      parts: ['labels'],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a script it cannot read off and does not read it again', async () => {
    const { check, fetch } = setup('var a="');
    const pair = { app: NEW_APP, vendors: VENDORS };
    expect(await check.check(pair)).toEqual({ status: 'unreadable' });
    expect(await check.check(pair)).toEqual({ status: 'unreadable' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a script the reader faults on as unreadable, never read again', async () => {
    const { check, fetch, advance } = setup(READER_FAULT);
    const pair = { app: NEW_APP, vendors: VENDORS };
    expect(await check.check(pair)).toEqual({ status: 'unreadable' });
    advance(HOST_CHECK_RETRY_MS * 3);
    expect(await check.check(pair)).toEqual({ status: 'unreadable' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('tries a failed request again only an hour later', async () => {
    const { check, fetch, advance } = setup(new TypeError('offline'));
    const pair = { app: NEW_APP, vendors: VENDORS };
    expect(await check.check(pair)).toEqual({ status: 'failed' });
    advance(HOST_CHECK_RETRY_MS - 1);
    expect(await check.check(pair)).toEqual({ status: 'failed' });
    expect(fetch).toHaveBeenCalledTimes(1);
    advance(1);
    await check.check(pair);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers even when storage fails', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(REPLICA, { headers: JS })),
    );
    const broken = {
      get: () => Promise.reject(new Error('quota')),
      set: () => Promise.reject(new Error('quota')),
      remove: () => Promise.resolve(),
    };
    const check = createHostCheck({
      env: { fetch, now: () => 0 },
      repo: createHostCheckRepository(broken),
      recorded: () => [REPLICA_BUILD],
    });
    expect(await check.check({ app: NEW_APP, vendors: VENDORS })).toEqual({
      status: 'verified',
    });
  });

  it('keeps a new build off when nothing recorded matches it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(REPLICA, { headers: JS })),
    );
    const check = createHostCheck({
      env: { fetch, now: () => 0 },
      repo: createHostCheckRepository(createMemoryStorage()),
      recorded: () => [],
    });
    const verdict = await check.check({ app: NEW_APP, vendors: VENDORS });
    expect(verdict.status).toBe('mismatch');
  });
});
