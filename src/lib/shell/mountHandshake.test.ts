import { describe, expect, it, vi } from 'vitest';
import {
  actionShortcut,
  answerMountHandshake,
  type MountHandshakeDeps,
} from './mountHandshake';
import { createTabIntentStore } from '../storage/tabIntents';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const COMMANDS = [
  { name: 'other', shortcut: 'Alt+O' },
  { name: '_execute_action', shortcut: 'Alt+Shift+P' },
];

function setup(overrides: Partial<MountHandshakeDeps> = {}) {
  const intents = createTabIntentStore(createMemoryStorage());
  const deps = {
    intents,
    getCommands: vi.fn(() => Promise.resolve(COMMANDS)),
    ...overrides,
  } satisfies MountHandshakeDeps;
  return { deps, intents };
}

describe('answerMountHandshake', () => {
  it('answers openPanel once for the tab a pending open intent names', async () => {
    const { deps, intents } = setup();
    await intents.add(7, 'open');
    expect(await answerMountHandshake({ tabId: 7 }, deps)).toEqual({
      openPanel: true,
      shortcut: 'Alt+Shift+P',
    });
    expect(await answerMountHandshake({ tabId: 7 }, deps)).toEqual({
      openPanel: false,
      shortcut: 'Alt+Shift+P',
    });
  });

  it('answers no open for another tab and leaves the intent in place', async () => {
    const { deps, intents } = setup();
    await intents.add(7, 'open');
    expect((await answerMountHandshake({ tabId: 8 }, deps)).openPanel).toBe(
      false,
    );
    expect(await intents.pendingOpenTab()).toBe(7);
  });

  it('answers no open for a sender without a tab', async () => {
    const { deps, intents } = setup();
    await intents.add(7, 'open');
    expect((await answerMountHandshake({ tabId: null }, deps)).openPanel).toBe(
      false,
    );
  });

  it('answers no open without a session area or when the read fails', async () => {
    const { deps } = setup({ intents: null });
    expect((await answerMountHandshake({ tabId: 7 }, deps)).openPanel).toBe(
      false,
    );
    const failing = createTabIntentStore({
      ...createMemoryStorage(),
      get: () => Promise.reject(new Error('storage fault')),
    });
    const faulted = setup({ intents: failing });
    expect(
      (await answerMountHandshake({ tabId: 7 }, faulted.deps)).openPanel,
    ).toBe(false);
  });

  it('answers no shortcut when the command list cannot be read', async () => {
    const { deps } = setup({
      getCommands: () => Promise.reject(new Error('unavailable')),
    });
    expect((await answerMountHandshake({ tabId: 7 }, deps)).shortcut).toBe(
      null,
    );
  });
});

describe('actionShortcut', () => {
  it('reads the shortcut of the action command', () => {
    expect(actionShortcut(COMMANDS)).toBe('Alt+Shift+P');
  });

  it('is null when the command is absent or has no shortcut', () => {
    expect(actionShortcut([])).toBeNull();
    expect(actionShortcut([{ name: '_execute_action' }])).toBeNull();
    expect(actionShortcut([{ name: '_execute_action', shortcut: '' }])).toBe(
      null,
    );
  });
});
