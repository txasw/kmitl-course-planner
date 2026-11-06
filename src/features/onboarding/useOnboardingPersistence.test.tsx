import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  createInstallRepository,
  type InstallRecord,
} from '@/lib/storage/install';
import {
  createOnboardingRepository,
  type OnboardingRecord,
  type OnboardingRepository,
} from '@/lib/storage/onboarding';
import { INSTALL_KEY, ONBOARDING_KEY } from '@/lib/storage/keys';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import {
  useOnboardingPersistence,
  type OnboardingPersistenceDeps,
} from './useOnboardingPersistence';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { uiStore } from '@/features/shell/uiStore';

const INSTALL: InstallRecord = {
  schemaVersion: 1,
  installedAt: '2026-11-06T08:00:00.000Z',
  version: '1.4.0',
};
const SHOWN = '2026-11-06T08:00:05.000Z';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function storageDeps(
  initial: Record<string, unknown> = {},
): OnboardingPersistenceDeps & {
  storage: ReturnType<typeof createMemoryStorage>;
} {
  const storage = createMemoryStorage(initial);
  return {
    storage,
    install: createInstallRepository(storage),
    record: createOnboardingRepository(storage),
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
  });
  onboardingStore.setState(initialOnboardingData());
});

function openPanel(): void {
  act(() => {
    uiStore.getState().open();
  });
}

function closePanel(): void {
  act(() => {
    uiStore.getState().close();
  });
}

function onboardingWrites(
  storage: ReturnType<typeof createMemoryStorage>,
): unknown[] {
  return storage.set.mock.calls
    .filter(([key]) => key === ONBOARDING_KEY)
    .map(([, value]) => value);
}

describe('useOnboardingPersistence', () => {
  it('turns loaded true only after both reads settle', async () => {
    const installRead = deferred<InstallRecord | null>();
    const recordRead = deferred<OnboardingRecord>();
    const install: OnboardingPersistenceDeps['install'] = {
      load: () => installRead.promise,
    };
    const record: OnboardingRepository = {
      load: () => recordRead.promise,
      patch: () => Promise.resolve({ schemaVersion: 1 }),
    };
    renderHook(() => {
      useOnboardingPersistence({ install, record });
    });

    await act(async () => {
      installRead.resolve(INSTALL);
      await Promise.resolve();
    });
    expect(onboardingStore.getState().loaded).toBe(false);

    await act(async () => {
      recordRead.resolve({ schemaVersion: 1 });
      await Promise.resolve();
    });
    await flush();
    expect(onboardingStore.getState().loaded).toBe(true);
    expect(onboardingStore.getState().install).toEqual(INSTALL);
  });

  it.each([
    ['the install read', 'install'],
    ['the onboarding read', 'record'],
  ] as const)(
    'still turns loaded true when %s rejects',
    async (_label, side) => {
      const install: OnboardingPersistenceDeps['install'] = {
        load: () =>
          side === 'install'
            ? Promise.reject(new Error('read failed'))
            : Promise.resolve(INSTALL),
      };
      const record: OnboardingRepository = {
        load: () =>
          side === 'record'
            ? Promise.reject(new Error('read failed'))
            : Promise.resolve({ schemaVersion: 1, welcomeShownAt: SHOWN }),
        patch: () => Promise.resolve({ schemaVersion: 1 }),
      };
      renderHook(() => {
        useOnboardingPersistence({ install, record });
      });
      await flush();

      const state = onboardingStore.getState();
      expect(state.loaded).toBe(true);
      if (side === 'install') {
        expect(state.install).toBeNull();
        expect(state.record.welcomeShownAt).toBe(SHOWN);
      } else {
        expect(state.install).toEqual(INSTALL);
        expect(state.record).toEqual({ schemaVersion: 1 });
      }
    },
  );

  it('marks the welcome pending at load for an install with no welcome shown', async () => {
    const deps = storageDeps({ [INSTALL_KEY]: INSTALL });
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    expect(onboardingStore.getState().welcomePendingAtLoad).toBe(true);
    expect(onboardingStore.getState().documentSuppressed).toBe(true);
  });

  it('leaves the document unsuppressed once the welcome has shown', async () => {
    const deps = storageDeps({
      [INSTALL_KEY]: INSTALL,
      [ONBOARDING_KEY]: { schemaVersion: 1, welcomeShownAt: SHOWN },
    });
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    expect(onboardingStore.getState().welcomePendingAtLoad).toBe(false);
    expect(onboardingStore.getState().documentSuppressed).toBe(false);
  });

  it('settles the welcome decision after the read and leaves the handshake', async () => {
    const deps = storageDeps();
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    expect(onboardingStore.getState().welcomeSettled).toBe(false);
    await flush();
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
    expect(onboardingStore.getState().handshakeSettled).toBe(false);
  });

  it('writes nothing while it only reads', async () => {
    const deps = storageDeps({ [INSTALL_KEY]: INSTALL });
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    expect(deps.storage.set).not.toHaveBeenCalled();
  });

  it('ignores a read that settles after unmount', async () => {
    const recordRead = deferred<OnboardingRecord>();
    const deps: OnboardingPersistenceDeps = {
      install: { load: () => Promise.resolve(null) },
      record: {
        load: () => recordRead.promise,
        patch: () => Promise.resolve({ schemaVersion: 1 }),
      },
    };
    const { unmount } = renderHook(() => {
      useOnboardingPersistence(deps);
    });
    unmount();
    await act(async () => {
      recordRead.resolve({ schemaVersion: 1 });
      await Promise.resolve();
    });
    await flush();
    expect(onboardingStore.getState().loaded).toBe(false);
  });

  it('records the first panel open', async () => {
    const deps = storageDeps();
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    openPanel();
    await flush();

    const writes = onboardingWrites(deps.storage);
    expect(writes).toHaveLength(1);
    const opened = onboardingStore.getState().record.panelFirstOpenedAt;
    expect(opened).toEqual(expect.any(String));
    expect(writes[0]).toEqual({ schemaVersion: 1, panelFirstOpenedAt: opened });
  });

  it('never rewrites the first open on later opens', async () => {
    const deps = storageDeps();
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    openPanel();
    await flush();
    const first = onboardingStore.getState().record.panelFirstOpenedAt;
    closePanel();
    openPanel();
    await flush();

    expect(onboardingWrites(deps.storage)).toHaveLength(1);
    expect(onboardingStore.getState().record.panelFirstOpenedAt).toBe(first);
  });

  it('writes nothing when the stored record already has the first open', async () => {
    const deps = storageDeps({
      [ONBOARDING_KEY]: { schemaVersion: 1, panelFirstOpenedAt: SHOWN },
    });
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    openPanel();
    await flush();

    expect(deps.storage.set).not.toHaveBeenCalled();
    expect(onboardingStore.getState().record.panelFirstOpenedAt).toBe(SHOWN);
  });

  it('writes the first open once when a second app is mounted', async () => {
    const storage = createMemoryStorage();
    const first: OnboardingPersistenceDeps = {
      install: createInstallRepository(storage),
      record: createOnboardingRepository(storage),
    };
    const second: OnboardingPersistenceDeps = {
      install: createInstallRepository(storage),
      record: createOnboardingRepository(storage),
    };
    renderHook(() => {
      useOnboardingPersistence(first);
    });
    renderHook(() => {
      useOnboardingPersistence(second);
    });
    await flush();
    openPanel();
    await flush();

    expect(onboardingWrites(storage)).toHaveLength(1);
  });

  it('counts a panel opened while the records were being read', async () => {
    const deps = storageDeps();
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    openPanel();
    await flush();

    expect(onboardingWrites(deps.storage)).toHaveLength(1);
    expect(onboardingStore.getState().record.panelFirstOpenedAt).toBeDefined();
  });

  it('keeps a first open another tab wrote since the read', async () => {
    const deps = storageDeps();
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    deps.storage.store[ONBOARDING_KEY] = {
      schemaVersion: 1,
      panelFirstOpenedAt: SHOWN,
    };
    openPanel();
    await flush();

    expect(onboardingStore.getState().record.panelFirstOpenedAt).toBe(SHOWN);
    expect(deps.storage.store[ONBOARDING_KEY]).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: SHOWN,
    });
  });

  it('writes only the onboarding key, never the worker owned install key', async () => {
    const deps = storageDeps({ [INSTALL_KEY]: INSTALL });
    renderHook(() => {
      useOnboardingPersistence(deps);
    });
    await flush();
    openPanel();
    await flush();

    expect(deps.storage.set).toHaveBeenCalled();
    for (const [key] of deps.storage.set.mock.calls) {
      expect(key).toBe(ONBOARDING_KEY);
    }
    expect(deps.storage.store[INSTALL_KEY]).toEqual(INSTALL);
  });
});
