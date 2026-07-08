import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebugDispatch, installDebug } from './register';
import {
  getAudit,
  getRecorder,
  getSimulation,
  resetInterceptors,
} from '../interceptors';
import { setDebugDispatch, type RouterListener } from '../../messaging/router';
import { createGateway } from '../gateway';
import { createCacheStore } from '../cache';
import type { GatewayEnv } from '../types';
import type { StorageAdapter } from '../../storage/repo';
import type { TeachTableQuery } from '../../messaging/protocol';
import { loadFixture } from '../../../../tests/support/fixtures';

const noopRouter: RouterListener = () => undefined;

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

function readHandle(): unknown {
  return (globalThis as { __kcp?: unknown }).__kcp;
}

describe('installDebug', () => {
  afterEach(() => {
    resetInterceptors();
    setDebugDispatch(null);
    delete (globalThis as { __kcp?: unknown }).__kcp;
  });

  it('wires the interceptors and the console handle', () => {
    installDebug({
      extensionVersion: '0.0.0',
      runtimeId: 'id',
      router: noopRouter,
      now: () => 'T',
    });
    expect(getSimulation()).not.toBeNull();
    expect(getAudit()).not.toBeNull();
    expect(getRecorder()).not.toBeNull();
    expect(readHandle()).toBeDefined();
  });

  it('serves the request log, report, and settings via the dispatch', async () => {
    const state = installDebug({
      extensionVersion: '0.0.0',
      runtimeId: 'id',
      router: noopRouter,
      now: () => 'T',
    });
    const dispatch = createDebugDispatch(state);
    expect(await dispatch({ type: 'debug/getRequestLog' })).toEqual({
      ok: true,
      value: [],
    });
    expect(await dispatch({ type: 'debug/getReport' })).toEqual({
      ok: true,
      value: null,
    });
    expect(await dispatch({ type: 'debug/getLatestRaw' })).toEqual({
      ok: true,
      value: null,
    });
    await dispatch({ type: 'debug/setFault', faultId: 'timeout' });
    expect(state.getSettings().faultId).toBe('timeout');
    expect(await dispatch({ type: 'debug/getSimulation' })).toEqual({
      ok: true,
      value: { fixtureId: null, faultId: 'timeout', mutationId: null },
    });
  });

  it('captures the latest teach table raw payload for the drawer', () => {
    const state = installDebug({
      extensionVersion: '0.0.0',
      runtimeId: 'id',
      router: noopRouter,
      now: () => 'T',
    });
    const audit = getAudit();
    const context = {
      endpoint: 'get-teach-table-show',
      params: { mode: 'by_class' },
      url: 'https://example.test',
    };
    const raw = [{ teachtable: [] }];
    audit?.observe(context, raw);
    expect(state.getLatestRaw()).toEqual({
      raw,
      request: {
        endpoint: 'get-teach-table-show',
        params: { mode: 'by_class' },
      },
    });
  });

  it('surfaces an injected unknown field in the report through the gateway', async () => {
    const state = installDebug({
      extensionVersion: '0.0.0',
      runtimeId: 'id',
      router: noopRouter,
      now: () => 'T',
    });
    state.setSettings({ mutationId: 'inject_unknown_field' });
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    const env: GatewayEnv = {
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(fixture), { status: 200 }),
        ),
      now: () => 0,
      random: () => 0.5,
      sleep: () => Promise.resolve(),
    };
    const gateway = createGateway({
      cache: createCacheStore(fakeAdapter()),
      env,
    });
    const query: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: false,
      selected_subject_owner_id: '32',
    };
    const result = await gateway.teachTable(query);
    expect(result.ok).toBe(true);
    expect(state.getReport()?.totals.byKind.unknown_field).toBeGreaterThan(0);
  });
});
