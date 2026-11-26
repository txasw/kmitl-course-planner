import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { buildCheckStore } from './host/buildCheckStore';
import { checkHostBuild } from './useHostBuildCheck';

const VENDORS = 'chunk-vendors.7ab4925e.js';
const NEW = ['app.c0ffee01.js', VENDORS];

function sender(reply: unknown) {
  const send = vi.fn(() => Promise.resolve(reply));
  // Test only: the fake answers every message the same way.
  return { send, typed: send as unknown as TypedSend };
}

afterEach(() => {
  buildCheckStore.setState({ check: null });
});

describe('checkHostBuild', () => {
  it('sends only the two public names, once per build, and keeps the verdict', async () => {
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    const pending = checkHostBuild(typed, NEW);
    expect(buildCheckStore.getState().check).toEqual({
      key: 'app.c0ffee01.js chunk-vendors.7ab4925e.js',
      verdict: null,
    });
    await pending;
    await checkHostBuild(typed, NEW);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'regis/hostBuild',
      app: 'app.c0ffee01.js',
      vendors: VENDORS,
    });
    expect(buildCheckStore.getState().check?.verdict).toEqual({
      status: 'verified',
    });
  });

  it('asks nothing for a tested pair or an untested vendor script', async () => {
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    await checkHostBuild(typed, ['app.ba450963.js', VENDORS]);
    await checkHostBuild(typed, [
      'app.c0ffee01.js',
      'chunk-vendors.00000000.js',
    ]);
    expect(send).not.toHaveBeenCalled();
    expect(buildCheckStore.getState().check).toBeNull();
  });

  it.each([
    ['an error reply', { ok: false, error: { kind: 'network', message: 'x' } }],
    ['a malformed verdict', { ok: true, value: { status: 'trusted' } }],
    ['no reply', undefined],
  ])('reads %s as a check that could not run', async (_name, reply) => {
    await checkHostBuild(sender(reply).typed, NEW);
    expect(buildCheckStore.getState().check?.verdict).toEqual({
      status: 'failed',
    });
  });
});
