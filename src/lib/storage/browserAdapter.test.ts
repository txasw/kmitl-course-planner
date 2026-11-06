import { afterEach, describe, expect, it, vi } from 'vitest';

const { storage } = vi.hoisted(() => {
  const area = () => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() });
  const areas: {
    local: ReturnType<typeof area>;
    session: ReturnType<typeof area> | undefined;
  } = { local: area(), session: area() };
  return { storage: areas };
});
vi.mock('wxt/browser', () => ({ browser: { storage } }));

import {
  createBrowserStorageAdapter,
  createSessionStorageAdapter,
} from './browserAdapter';

const { local } = storage;

describe('createBrowserStorageAdapter', () => {
  afterEach(() => {
    local.get.mockReset();
    local.set.mockReset();
    local.remove.mockReset();
  });

  it('reads the value stored under a key', async () => {
    local.get.mockResolvedValue({ 'kcp:cache:ref:faculty': { value: 1 } });
    const adapter = createBrowserStorageAdapter();
    const result = await adapter.get('kcp:cache:ref:faculty');
    expect(result).toEqual({ value: 1 });
    expect(local.get).toHaveBeenCalledWith('kcp:cache:ref:faculty');
  });

  it('returns undefined when the key is absent', async () => {
    local.get.mockResolvedValue({});
    const adapter = createBrowserStorageAdapter();
    expect(await adapter.get('missing')).toBeUndefined();
  });

  it('writes a value under its key', async () => {
    local.set.mockResolvedValue(undefined);
    const adapter = createBrowserStorageAdapter();
    await adapter.set('k', { a: 1 });
    expect(local.set).toHaveBeenCalledWith({ k: { a: 1 } });
  });

  it('removes a key', async () => {
    local.remove.mockResolvedValue(undefined);
    const adapter = createBrowserStorageAdapter();
    await adapter.remove('k');
    expect(local.remove).toHaveBeenCalledWith('k');
  });

  it('lists every stored key', async () => {
    local.get.mockResolvedValue({ 'kcp:v1': {}, 'kcp:cache:ref:faculty': {} });
    const adapter = createBrowserStorageAdapter();
    expect(await adapter.keys?.()).toEqual(['kcp:v1', 'kcp:cache:ref:faculty']);
    expect(local.get).toHaveBeenCalledWith(null);
  });

  it('lists no keys when the area answers with nothing', async () => {
    local.get.mockResolvedValue(undefined);
    const adapter = createBrowserStorageAdapter();
    expect(await adapter.keys?.()).toEqual([]);
  });
});

describe('createSessionStorageAdapter', () => {
  const session = storage.session;

  afterEach(() => {
    storage.session = session;
  });

  it('reads and writes the session area, not the local one', async () => {
    session?.get.mockResolvedValue({ 'kcp:session:tabIntents': { a: 1 } });
    session?.set.mockResolvedValue(undefined);
    const adapter = createSessionStorageAdapter();
    expect(await adapter?.get('kcp:session:tabIntents')).toEqual({ a: 1 });
    await adapter?.set('kcp:session:tabIntents', { b: 2 });
    expect(session?.set).toHaveBeenCalledWith({
      'kcp:session:tabIntents': { b: 2 },
    });
    expect(local.set).not.toHaveBeenCalled();
  });

  it('returns null when storage.session is undefined', () => {
    storage.session = undefined;
    expect(createSessionStorageAdapter()).toBeNull();
  });
});
