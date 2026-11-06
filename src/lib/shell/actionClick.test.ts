import { describe, expect, it, vi } from 'vitest';
import { handleActionClick, type ActionClickDeps } from './actionClick';
import { SELECTOR_URL } from './hostTab';
import { createTabIntentStore } from '../storage/tabIntents';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const START = Date.parse('2026-11-06T08:00:00.000Z');

function setup(overrides: Partial<ActionClickDeps> = {}) {
  const clock = { at: START };
  const intents = createTabIntentStore(createMemoryStorage(), {
    now: () => clock.at,
  });
  let nextId = 40;
  const deps = {
    requestHostAccess: null,
    sendToTab: vi.fn<ActionClickDeps['sendToTab']>(() =>
      Promise.reject(new Error('Receiving end does not exist')),
    ),
    activateTab: vi.fn<ActionClickDeps['activateTab']>(() =>
      Promise.resolve(true),
    ),
    createTab: vi.fn<ActionClickDeps['createTab']>(() =>
      Promise.resolve(nextId++),
    ),
    intents,
    ...overrides,
  } satisfies ActionClickDeps;
  return { deps, intents, clock };
}

describe('handleActionClick', () => {
  it('opens no tab when the clicked tab acknowledges the command', async () => {
    const { deps } = setup({
      sendToTab: vi.fn(() => Promise.resolve({ received: true })),
    });
    expect(await handleActionClick({ id: 7 }, deps)).toBe('delivered');
    expect(deps.sendToTab).toHaveBeenCalledWith(7, { type: 'shell/openPanel' });
    expect(deps.createTab).not.toHaveBeenCalled();
  });

  it('opens the search page and records an open intent when nothing answers', async () => {
    const { deps, intents } = setup();
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(deps.createTab).toHaveBeenCalledWith(SELECTOR_URL);
    expect(await intents.consume(40)).toBe(true);
    expect(await intents.consume(7)).toBe(false);
  });

  it('treats a reply that is not the acknowledgement as no receiver', async () => {
    for (const reply of [undefined, {}, { received: 'yes' }]) {
      const { deps } = setup({
        sendToTab: vi.fn(() => Promise.resolve(reply)),
      });
      expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
      expect(deps.createTab).toHaveBeenCalledTimes(1);
    }
  });

  it('records the intent in the same queued step that creates the tab', async () => {
    let release: (id: number) => void = () => undefined;
    const { deps, intents } = setup({
      createTab: vi.fn(
        () =>
          new Promise<number | null>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const click = handleActionClick({ id: 7 }, deps);
    await vi.waitFor(() => {
      expect(deps.createTab).toHaveBeenCalled();
    });
    // The new tab's content script asks before the create has resolved.
    const consumed = intents.consume(40);
    release(40);
    expect(await click).toBe('created');
    expect(await consumed).toBe(true);
  });

  it('brings the pending tab forward on a second click instead of opening another', async () => {
    const { deps } = setup();
    await handleActionClick({ id: 7 }, deps);
    expect(await handleActionClick({ id: 7 }, deps)).toBe('activated');
    expect(deps.activateTab).toHaveBeenCalledWith(40);
    expect(deps.createTab).toHaveBeenCalledTimes(1);
  });

  it('opens a fresh tab once the pending intent expires', async () => {
    const { deps, clock } = setup();
    await handleActionClick({ id: 7 }, deps);
    clock.at += 60_000;
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(deps.activateTab).not.toHaveBeenCalled();
    expect(deps.createTab).toHaveBeenCalledTimes(2);
  });

  it('opens a fresh tab when the pending tab was closed', async () => {
    const { deps, intents } = setup({
      activateTab: vi.fn(() => Promise.resolve(false)),
    });
    await handleActionClick({ id: 7 }, deps);
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(deps.createTab).toHaveBeenCalledTimes(2);
    expect(await intents.consume(41)).toBe(true);
  });

  it('does nothing when the student declines host access on Firefox', async () => {
    for (const answer of [
      () => Promise.resolve(false),
      () => Promise.reject(new Error('not a user gesture')),
    ]) {
      const { deps } = setup({ requestHostAccess: vi.fn(answer) });
      expect(await handleActionClick({ id: 7 }, deps)).toBe('declined');
      expect(deps.sendToTab).not.toHaveBeenCalled();
      expect(deps.createTab).not.toHaveBeenCalled();
    }
  });

  it('asks for host access before its first await', () => {
    const { deps } = setup({
      requestHostAccess: vi.fn(() => Promise.resolve(true)),
    });
    const click = handleActionClick({ id: 7 }, deps);
    // Still inside the synchronous part of the call, which is the user gesture.
    expect(deps.requestHostAccess).toHaveBeenCalledTimes(1);
    expect(deps.sendToTab).not.toHaveBeenCalled();
    return expect(click).resolves.toBe('created');
  });

  it('opens the tab and records nothing without a session area', async () => {
    const { deps } = setup({ intents: null });
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(deps.createTab).toHaveBeenCalledWith(SELECTOR_URL);
    expect(deps.activateTab).not.toHaveBeenCalled();
  });

  it('opens the search page when the session area cannot be read or written', async () => {
    const intents = createTabIntentStore({
      ...createMemoryStorage(),
      get: () => Promise.reject(new Error('storage fault')),
      set: () => Promise.reject(new Error('storage fault')),
    });
    const { deps } = setup({ intents });
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(deps.createTab).toHaveBeenCalledWith(SELECTOR_URL);
    expect(deps.activateTab).not.toHaveBeenCalled();
  });

  it('opens the search page for a click that carries no usable tab id', async () => {
    for (const tab of [{}, { id: -1 }]) {
      const { deps } = setup();
      expect(await handleActionClick(tab, deps)).toBe('created');
      expect(deps.sendToTab).not.toHaveBeenCalled();
    }
  });

  it('records nothing when the browser gives the new tab no id', async () => {
    const { deps, intents } = setup({
      createTab: vi.fn(() => Promise.resolve(null)),
    });
    expect(await handleActionClick({ id: 7 }, deps)).toBe('created');
    expect(await intents.pendingOpenTab()).toBeNull();
  });
});
