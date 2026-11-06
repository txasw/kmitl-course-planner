import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ContentListener } from '@/lib/messaging/contentRouter';
import { uiStore } from '@/features/shell/uiStore';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import {
  useWorkerHandshake,
  type WorkerHandshakeDeps,
} from './useWorkerHandshake';

const RUNTIME_ID = 'kcp-test-id';

function setup(reply: () => Promise<unknown>) {
  const calls: string[] = [];
  const listeners = new Set<ContentListener>();
  const deps = {
    runtimeId: RUNTIME_ID,
    onMessage: {
      addListener: (listener: ContentListener) => {
        calls.push('listen');
        listeners.add(listener);
      },
      removeListener: (listener: ContentListener) => {
        listeners.delete(listener);
      },
    },
    send: vi.fn(() => {
      calls.push('send');
      return reply();
    }),
  } satisfies WorkerHandshakeDeps;
  return { deps, calls, listeners };
}

function accepted(openPanel: boolean, shortcut: string | null = null) {
  return () => Promise.resolve({ ok: true, value: { openPanel, shortcut } });
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
  });
  onboardingStore.setState(initialOnboardingData());
});

describe('useWorkerHandshake', () => {
  it('listens for the worker before it sends the handshake', async () => {
    const { deps, calls } = setup(accepted(false));
    renderHook(() => {
      useWorkerHandshake(deps);
    });
    await flush();
    expect(calls).toEqual(['listen', 'send']);
    expect(deps.send).toHaveBeenCalledWith({ type: 'shell/mounted' });
  });

  it('opens the panel and quiets the document when the worker asks', async () => {
    const { deps } = setup(accepted(true));
    renderHook(() => {
      useWorkerHandshake(deps);
    });
    await flush();
    expect(uiStore.getState().isOpen).toBe(true);
    expect(onboardingStore.getState().documentSuppressed).toBe(true);
    expect(onboardingStore.getState().handshakeSettled).toBe(true);
  });

  it('stores the shortcut in words and leaves the panel closed', async () => {
    const { deps } = setup(accepted(false, '⇧⌥P'));
    renderHook(() => {
      useWorkerHandshake(deps);
    });
    await flush();
    expect(onboardingStore.getState().shortcut).toBe('Shift+Option+P');
    expect(uiStore.getState().isOpen).toBe(false);
    expect(onboardingStore.getState().documentSuppressed).toBe(false);
  });

  it('settles with no open on an error result or a malformed reply', async () => {
    for (const reply of [
      { ok: false, error: { kind: 'network', message: 'down' } },
      { ok: true, value: { openPanel: 'yes', shortcut: null } },
      undefined,
    ]) {
      onboardingStore.setState(initialOnboardingData());
      const { deps } = setup(() => Promise.resolve(reply));
      const { unmount } = renderHook(() => {
        useWorkerHandshake(deps);
      });
      await flush();
      expect(onboardingStore.getState().handshakeSettled).toBe(true);
      expect(uiStore.getState().isOpen).toBe(false);
      unmount();
    }
  });

  it('settles with no open when the send rejects', async () => {
    const { deps } = setup(() => Promise.reject(new Error('no worker')));
    renderHook(() => {
      useWorkerHandshake(deps);
    });
    await flush();
    expect(onboardingStore.getState().handshakeSettled).toBe(true);
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('sends exactly once per mount', async () => {
    const { deps } = setup(accepted(false));
    const { rerender } = renderHook(() => {
      useWorkerHandshake(deps);
    });
    rerender();
    await flush();
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it('opens the panel and closes the welcome on a worker command', async () => {
    const { deps, listeners } = setup(accepted(false));
    renderHook(() => {
      useWorkerHandshake(deps);
    });
    await flush();
    act(() => {
      onboardingStore.getState().setWelcomeOpen(true);
    });
    const sendResponse = vi.fn();
    act(() => {
      for (const listener of listeners) {
        listener({ type: 'shell/openPanel' }, { id: RUNTIME_ID }, sendResponse);
      }
    });
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
    expect(uiStore.getState().isOpen).toBe(true);
    expect(onboardingStore.getState().welcomeOpen).toBe(false);
  });

  it('stops listening on unmount and ignores a late reply', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const { deps, listeners } = setup(
      () =>
        new Promise((settle) => {
          resolve = settle;
        }),
    );
    const { unmount } = renderHook(() => {
      useWorkerHandshake(deps);
    });
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
    resolve({ ok: true, value: { openPanel: true, shortcut: null } });
    await flush();
    expect(uiStore.getState().isOpen).toBe(false);
    expect(onboardingStore.getState().handshakeSettled).toBe(false);
  });
});
