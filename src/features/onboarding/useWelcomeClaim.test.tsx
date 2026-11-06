import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { InstallRecord } from '@/lib/storage/install';
import {
  createOnboardingRepository,
  onboardingRecordSchema,
  type OnboardingRecord,
} from '@/lib/storage/onboarding';
import { ONBOARDING_KEY } from '@/lib/storage/keys';
import { uiStore } from '@/features/shell/uiStore';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { applyRequestedOpen } from './useWorkerHandshake';
import { useWelcomeClaim, type WelcomeClaimDeps } from './useWelcomeClaim';

const INSTALL: InstallRecord = {
  schemaVersion: 1,
  installedAt: '2026-11-06T08:00:00.000Z',
  version: '1.4.0',
};
const SHOWN = '2026-11-06T08:00:05.000Z';
const EMPTY: OnboardingRecord = { schemaVersion: 1 };

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

function granted(value: boolean) {
  return () => Promise.resolve({ ok: true, value: { granted: value } });
}

function setup(
  reply: () => Promise<unknown> = granted(true),
  stored: Record<string, unknown> = {},
) {
  const storage = createMemoryStorage(stored);
  const deps = {
    record: createOnboardingRepository(storage),
    send: vi.fn(reply),
  } satisfies WelcomeClaimDeps;
  return { storage, deps };
}

// The state the persistence and handshake hooks leave once both have settled.
function settle(
  install: InstallRecord | null = INSTALL,
  record: OnboardingRecord = EMPTY,
  { openRequested = false }: { openRequested?: boolean } = {},
): void {
  act(() => {
    const store = onboardingStore.getState();
    store.hydrate(install, record);
    if (openRequested) store.markOpenRequested();
    store.settleHandshake();
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

function storedRecord(storage: ReturnType<typeof createMemoryStorage>) {
  return onboardingRecordSchema.safeParse(storage.store[ONBOARDING_KEY]).data;
}

beforeEach(() => {
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    uiStore.getState().close();
  });
  onboardingStore.setState(initialOnboardingData());
});

describe('useWelcomeClaim', () => {
  it('waits for the records and the handshake before it decides', async () => {
    const { deps } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    act(() => {
      onboardingStore.getState().hydrate(INSTALL, EMPTY);
    });
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeSettled).toBe(false);
    act(() => {
      onboardingStore.getState().settleHandshake();
    });
    await flush();
    expect(deps.send).toHaveBeenCalledWith({ type: 'onboarding/claimWelcome' });
    expect(onboardingStore.getState().welcomeOpen).toBe(true);
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
  });

  it('sends no claim without an install record', async () => {
    const { deps } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle(null);
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
    expect(onboardingStore.getState().welcomeOpen).toBe(false);
  });

  it('sends no claim once the welcome has been shown', async () => {
    const { deps } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle(INSTALL, { schemaVersion: 1, welcomeShownAt: SHOWN });
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
  });

  it('sends no claim when a fresh read finds the welcome shown by another tab', async () => {
    const { deps } = setup(granted(true), {
      [ONBOARDING_KEY]: { schemaVersion: 1, welcomeShownAt: SHOWN },
    });
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeOpen).toBe(false);
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
  });

  it('sends no claim when the handshake applied a requested open', async () => {
    const { deps } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle(INSTALL, EMPTY, { openRequested: true });
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
  });

  it('holds a hidden document until it becomes visible, then claims', async () => {
    visibility = 'hidden';
    const { deps } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    expect(onboardingStore.getState().welcomeSettled).toBe(false);
    act(() => {
      setVisibility('hidden');
    });
    await flush();
    expect(deps.send).not.toHaveBeenCalled();
    act(() => {
      setVisibility('visible');
    });
    await flush();
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(onboardingStore.getState().welcomeOpen).toBe(true);
  });

  it('writes welcomeShownAt before the welcome opens', async () => {
    const { deps, storage } = setup();
    const shownWhenOpened: (string | undefined)[] = [];
    const unsubscribe = onboardingStore.subscribe((state, previous) => {
      if (state.welcomeOpen && !previous.welcomeOpen) {
        shownWhenOpened.push(storedRecord(storage)?.welcomeShownAt);
      }
    });
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    await flush();
    unsubscribe();
    expect(shownWhenOpened).toHaveLength(1);
    expect(shownWhenOpened[0]).toEqual(expect.any(String));
    expect(onboardingStore.getState().record.welcomeShownAt).toBe(
      shownWhenOpened[0],
    );
    expect(onboardingStore.getState().documentSuppressed).toBe(true);
  });

  it('settles closed on a denial, an error result, a malformed reply, or a failed send', async () => {
    for (const reply of [
      granted(false),
      () => Promise.resolve({ ok: false, error: { kind: 'network' } }),
      () => Promise.resolve({ ok: true, value: { granted: 'yes' } }),
      () => Promise.reject(new Error('no worker')),
    ]) {
      onboardingStore.setState(initialOnboardingData());
      const { deps, storage } = setup(reply);
      const { unmount } = renderHook(() => {
        useWelcomeClaim(deps);
      });
      settle();
      await flush();
      expect(deps.send).toHaveBeenCalledTimes(1);
      expect(onboardingStore.getState().welcomeSettled).toBe(true);
      expect(onboardingStore.getState().welcomeOpen).toBe(false);
      expect(storedRecord(storage)?.welcomeShownAt).toBeUndefined();
      unmount();
    }
  });

  it('leaves the welcome pending when a worker open arrives during the claim', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const { deps, storage } = setup(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    await flush();
    act(() => {
      applyRequestedOpen();
    });
    answer({ ok: true, value: { granted: true } });
    await flush();
    expect(onboardingStore.getState().welcomeOpen).toBe(false);
    expect(onboardingStore.getState().welcomeSettled).toBe(true);
    expect(storedRecord(storage)?.welcomeShownAt).toBeUndefined();
    expect(uiStore.getState().isOpen).toBe(true);
  });

  it('closes the welcome for a worker open and keeps welcomeShownAt set', async () => {
    const { deps, storage } = setup();
    renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    await flush();
    expect(onboardingStore.getState().welcomeOpen).toBe(true);
    act(() => {
      applyRequestedOpen();
    });
    expect(onboardingStore.getState().welcomeOpen).toBe(false);
    expect(uiStore.getState().isOpen).toBe(true);
    expect(storedRecord(storage)?.welcomeShownAt).toEqual(expect.any(String));
    expect(onboardingStore.getState().record.welcomeShownAt).toEqual(
      expect.any(String),
    );
  });

  it('claims once per document', async () => {
    const { deps } = setup(granted(false));
    const { rerender } = renderHook(() => {
      useWelcomeClaim(deps);
    });
    settle();
    rerender();
    await flush();
    rerender();
    await flush();
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
});
