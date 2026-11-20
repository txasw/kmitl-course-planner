import { describe, expect, it } from 'vitest';
import {
  needsLauncherAttention,
  type LauncherAttentionInput,
} from './launcherAttention';

const OPENED = { panelFirstOpenedAt: '2026-11-06T08:00:00.000Z' };

function input(
  overrides: Partial<LauncherAttentionInput> = {},
): LauncherAttentionInput {
  return {
    loaded: true,
    record: {},
    hasStoredPlans: false,
    welcomeOpen: false,
    coachMarkOpen: false,
    coachMarkDismissed: false,
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
    expect(needsLauncherAttention(input({ record: OPENED }))).toBe(false);
  });

  it('stays quiet for a student with stored plans', () => {
    expect(needsLauncherAttention(input({ hasStoredPlans: true }))).toBe(false);
  });

  it('stays quiet while the welcome is open', () => {
    expect(needsLauncherAttention(input({ welcomeOpen: true }))).toBe(false);
  });

  it('stays quiet while the selector coach mark is open', () => {
    expect(needsLauncherAttention(input({ coachMarkOpen: true }))).toBe(false);
  });
});

describe('needsLauncherAttention after a coach mark dismissal', () => {
  it('rings for a returning student who has opened the panel and stored plans', () => {
    expect(
      needsLauncherAttention(
        input({
          record: OPENED,
          hasStoredPlans: true,
          coachMarkDismissed: true,
        }),
      ),
    ).toBe(true);
  });

  it('rings for a first time student too', () => {
    expect(needsLauncherAttention(input({ coachMarkDismissed: true }))).toBe(
      true,
    );
  });

  it('still waits for the reads to settle', () => {
    expect(
      needsLauncherAttention(
        input({ loaded: false, coachMarkDismissed: true }),
      ),
    ).toBe(false);
  });

  it('stays quiet while the coach mark shows again on a later visit', () => {
    expect(
      needsLauncherAttention(
        input({
          record: OPENED,
          coachMarkDismissed: true,
          coachMarkOpen: true,
        }),
      ),
    ).toBe(false);
  });

  it('stays quiet under the welcome', () => {
    expect(
      needsLauncherAttention(
        input({ coachMarkDismissed: true, welcomeOpen: true }),
      ),
    ).toBe(false);
  });
});
