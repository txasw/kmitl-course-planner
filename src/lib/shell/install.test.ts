import { describe, expect, it, vi } from 'vitest';
import { handleInstalled, type InstalledDeps } from './install';
import { SELECTOR_URL } from './hostTab';
import {
  createInstallRepository,
  type InstallRecord,
} from '../storage/install';
import { INSTALL_KEY } from '../storage/keys';
import { createTabIntentStore } from '../storage/tabIntents';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const INSTALLED_AT = '2026-11-06T08:00:00.000Z';
const INSTALL_TAB = 40;
const OTHER_TAB = 41;

const prior: InstallRecord = {
  schemaVersion: 1,
  installedAt: '2026-10-01T08:00:00.000Z',
  version: '1.3.1',
};

function setup(
  overrides: Partial<InstalledDeps> = {},
  stored: Record<string, unknown> = {},
) {
  const local = createMemoryStorage(stored);
  const session = createMemoryStorage();
  const intents = createTabIntentStore(session, { now: () => 1_000 });
  const deps = {
    install: createInstallRepository(local, { now: () => INSTALLED_AT }),
    version: '1.4.0',
    hasHostAccess: vi.fn<InstalledDeps['hasHostAccess']>(() =>
      Promise.resolve(true),
    ),
    createTab: vi.fn<InstalledDeps['createTab']>(() =>
      Promise.resolve(INSTALL_TAB),
    ),
    intents,
    ...overrides,
  } satisfies InstalledDeps;
  return { deps, local, session, intents };
}

describe('handleInstalled', () => {
  it('records the install, opens the search page and marks it for the welcome', async () => {
    const { deps, local, intents } = setup();
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('opened');
    expect(local.store[INSTALL_KEY]).toEqual({
      schemaVersion: 1,
      installedAt: INSTALLED_AT,
      version: '1.4.0',
    });
    expect(deps.createTab).toHaveBeenCalledTimes(1);
    expect(deps.createTab).toHaveBeenCalledWith(
      'https://regis.reg.kmitl.ac.th/#/teach_table_selector',
    );
    expect(await intents.pendingWelcomeTab()).toBe(INSTALL_TAB);
    expect(await intents.pendingOpenTab()).toBeNull();
  });

  it('opens nothing when a prior install record exists', async () => {
    const { deps, local } = setup({}, { [INSTALL_KEY]: prior });
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('ignored');
    expect(deps.createTab).not.toHaveBeenCalled();
    expect(local.set).not.toHaveBeenCalled();
    expect(local.store[INSTALL_KEY]).toEqual(prior);
  });

  it('records the install but opens nothing without host access', async () => {
    const { deps, local, session } = setup({
      hasHostAccess: vi.fn(() => Promise.resolve(false)),
    });
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('recorded');
    expect(local.store[INSTALL_KEY]).toBeDefined();
    expect(deps.createTab).not.toHaveBeenCalled();
    expect(session.set).not.toHaveBeenCalled();
  });

  it('treats a failed access check as no access', async () => {
    const { deps } = setup({
      hasHostAccess: vi.fn(() => Promise.reject(new Error('unavailable'))),
    });
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('recorded');
    expect(deps.createTab).not.toHaveBeenCalled();
  });

  it.each([
    'update',
    'chrome_update',
    'browser_update',
    'shared_module_update',
  ])('writes nothing and opens nothing on %s', async (reason) => {
    const { deps, local, session } = setup();
    expect(await handleInstalled({ reason }, deps)).toBe('ignored');
    expect(local.set).not.toHaveBeenCalled();
    expect(session.set).not.toHaveBeenCalled();
    expect(deps.hasHostAccess).not.toHaveBeenCalled();
    expect(deps.createTab).not.toHaveBeenCalled();
  });

  it('records the welcome intent in the same queued step that creates the tab', async () => {
    let release: (id: number) => void = () => undefined;
    const { deps, intents } = setup({
      createTab: vi.fn(
        () =>
          new Promise<number | null>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const installed = handleInstalled({ reason: 'install' }, deps);
    await vi.waitFor(() => {
      expect(deps.createTab).toHaveBeenCalled();
    });
    // Another regis tab asks for the welcome before the create has resolved.
    const otherClaim = intents.claimWelcome(OTHER_TAB);
    release(INSTALL_TAB);
    expect(await installed).toBe('opened');
    expect(await otherClaim).toBe(false);
    expect(await intents.claimWelcome(INSTALL_TAB)).toBe(true);
  });

  it('holds a claim sent once the record exists until the intent is recorded', async () => {
    let grant: (granted: boolean) => void = () => undefined;
    const { deps, local, intents } = setup({
      hasHostAccess: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            grant = resolve;
          }),
      ),
    });
    const installed = handleInstalled({ reason: 'install' }, deps);
    await vi.waitFor(() => {
      expect(deps.hasHostAccess).toHaveBeenCalled();
    });
    // A regis tab that was already open reads the new record and asks for the welcome
    // while the access check is still pending.
    expect(local.store[INSTALL_KEY]).toBeDefined();
    const otherClaim = intents.claimWelcome(OTHER_TAB);
    grant(true);
    expect(await installed).toBe('opened');
    expect(await otherClaim).toBe(false);
    expect(await intents.claimWelcome(INSTALL_TAB)).toBe(true);
  });

  it('records no intent when the browser gives the tab no id', async () => {
    const { deps, session } = setup({
      createTab: vi.fn(() => Promise.resolve(null)),
    });
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('opened');
    expect(session.set).not.toHaveBeenCalled();
  });

  it('keeps the tab open when the session area cannot be written', async () => {
    const { deps, session } = setup();
    session.set.mockRejectedValue(new Error('quota'));
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('opened');
    expect(deps.createTab).toHaveBeenCalledWith(SELECTOR_URL);
  });

  it('opens the tab with no intent where the session area is missing', async () => {
    const { deps } = setup({ intents: null });
    expect(await handleInstalled({ reason: 'install' }, deps)).toBe('opened');
    expect(deps.createTab).toHaveBeenCalledWith(SELECTOR_URL);
  });
});
