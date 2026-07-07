import { afterEach, describe, expect, it, vi } from 'vitest';

const { local } = vi.hoisted(() => ({
  local: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: { storage: { local } } }));

import { createBrowserStorageAdapter } from './browserAdapter';

describe('createBrowserStorageAdapter', () => {
  afterEach(() => {
    local.get.mockReset();
    local.set.mockReset();
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
});
