import { describe, expect, it } from 'vitest';
import {
  needsLauncherAttention,
  type LauncherAttentionInput,
} from './launcherAttention';

function input(
  overrides: Partial<LauncherAttentionInput> = {},
): LauncherAttentionInput {
  return {
    loaded: true,
    record: {},
    hasStoredPlans: false,
    welcomeOpen: false,
    ...overrides,
  };
}

describe('needsLauncherAttention', () => {
  it('asks for attention on a settled first visit with no plans and no welcome', () => {
    expect(needsLauncherAttention(input())).toBe(true);
  });

  it('waits until the reads and the welcome decision have settled', () => {
    expect(needsLauncherAttention(input({ loaded: false }))).toBe(false);
  });

  it('stops once the panel has first opened', () => {
    expect(
      needsLauncherAttention(
        input({ record: { panelFirstOpenedAt: '2026-11-06T08:00:00.000Z' } }),
      ),
    ).toBe(false);
  });

  it('stays quiet for a student with stored plans', () => {
    expect(needsLauncherAttention(input({ hasStoredPlans: true }))).toBe(false);
  });

  it('stays quiet while the welcome is open', () => {
    expect(needsLauncherAttention(input({ welcomeOpen: true }))).toBe(false);
  });
});
