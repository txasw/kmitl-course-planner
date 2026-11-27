import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { addForMeBlock } from '@/lib/regis/helperStatus';
import { companionRoute } from '@/lib/regis/route';
import { buildCheckStore } from './host/buildCheckStore';
import { checkHostBuild, useHostBuildCheck } from './useHostBuildCheck';

const VENDORS = 'chunk-vendors.7ab4925e.js';
const NEW = ['app.c0ffee01.js', VENDORS];
const PAGE = '#/pre_registration';

function sender(reply: unknown) {
  const send = vi.fn(() => Promise.resolve(reply));
  // Test only: the fake answers every message the same way.
  return { send, typed: send as unknown as TypedSend };
}

function navigate(hash: string): void {
  window.history.replaceState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** The page's scripts, named as the host build names them. */
function loadScripts(names: readonly string[]): void {
  for (const name of names) {
    const script = document.createElement('script');
    script.setAttribute('src', `/js/${name}`);
    script.type = 'application/json';
    document.head.append(script);
  }
}

afterEach(() => {
  cleanup();
  buildCheckStore.setState({ check: null });
  for (const script of [...document.head.querySelectorAll('script')]) {
    script.remove();
  }
  window.history.replaceState(null, '', '#');
});

describe('checkHostBuild', () => {
  it('sends only the two public names, once per build, and keeps the verdict', async () => {
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    const pending = checkHostBuild(typed, NEW, PAGE);
    expect(buildCheckStore.getState().check).toEqual({
      key: 'app.c0ffee01.js chunk-vendors.7ab4925e.js',
      verdict: null,
    });
    await pending;
    await checkHostBuild(typed, NEW, PAGE);
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
    await checkHostBuild(typed, ['app.ba450963.js', VENDORS], PAGE);
    await checkHostBuild(
      typed,
      ['app.c0ffee01.js', 'chunk-vendors.00000000.js'],
      PAGE,
    );
    expect(send).not.toHaveBeenCalled();
    expect(buildCheckStore.getState().check).toBeNull();
  });

  it('asks nothing on any page but pre registration', async () => {
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    for (const hash of [
      '',
      '#/',
      '#/teach_table_selector',
      '#/teach_table?mode=by_class&selected_year=2569',
      '#/registration',
      '#/registration_for_officer',
      '#/pre_registration_x',
    ]) {
      await checkHostBuild(typed, NEW, hash);
    }
    expect(send).not.toHaveBeenCalled();
    expect(buildCheckStore.getState().check).toBeNull();
  });

  it.each([
    ['an error reply', { ok: false, error: { kind: 'network', message: 'x' } }],
    ['a malformed verdict', { ok: true, value: { status: 'trusted' } }],
    ['no reply', undefined],
  ])('reads %s as a check that could not run', async (_name, reply) => {
    await checkHostBuild(sender(reply).typed, NEW, PAGE);
    expect(buildCheckStore.getState().check?.verdict).toEqual({
      status: 'failed',
    });
  });
});

describe('useHostBuildCheck', () => {
  it('sends nothing while the host is on another route, and asks once on pre registration', async () => {
    loadScripts(NEW);
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    navigate('#/teach_table_selector');
    renderHook(() => {
      useHostBuildCheck(typed);
    });
    await act(async () => {
      navigate('#/registration');
      await Promise.resolve();
    });
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      navigate(PAGE);
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      navigate('#/teach_table_selector');
      await Promise.resolve();
    });
    await act(async () => {
      navigate(PAGE);
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on regular registration, where Add for me names the page instead', async () => {
    loadScripts(NEW);
    const { send, typed } = sender({ ok: true, value: { status: 'verified' } });
    navigate('#/registration');
    renderHook(() => {
      useHostBuildCheck(typed);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // No check ran, so the build reads as checking, and the route fact still comes first.
    const block = addForMeBlock({
      onPage: companionRoute(window.location.hash) === 'preRegistration',
      available: false,
      checking: true,
      off: false,
      preparing: false,
      target: true,
      kitStale: false,
      stale: false,
      termMismatch: false,
      inStep: false,
      busy: false,
    });
    expect(block).toBe('otherPage');
    expect(send).not.toHaveBeenCalled();
    expect(buildCheckStore.getState().check).toBeNull();
  });
});
