import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  OnboardingPatch,
  OnboardingRecord,
} from '@/lib/storage/onboarding';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { recordOnboardingMoment } from './recordOnboardingMoment';

const EARLIER = '2026-11-01T08:00:00.000Z';

function fakeRecord(resolve: (fields: OnboardingPatch) => OnboardingRecord) {
  return {
    patch: vi.fn((fields: OnboardingPatch) => Promise.resolve(resolve(fields))),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  onboardingStore.setState(initialOnboardingData());
});

describe('recordOnboardingMoment', () => {
  it('takes the moment in the store before the write and writes it once', async () => {
    const record = fakeRecord((fields) => ({ schemaVersion: 1, ...fields }));
    recordOnboardingMoment(record, 'entryToastOptOutAt');
    const taken = onboardingStore.getState().record.entryToastOptOutAt;
    expect(taken).toEqual(expect.any(String));
    expect(record.patch).toHaveBeenCalledWith({ entryToastOptOutAt: taken });

    recordOnboardingMoment(record, 'entryToastOptOutAt');
    expect(record.patch).toHaveBeenCalledTimes(1);
    await flush();
    expect(onboardingStore.getState().record.entryToastOptOutAt).toBe(taken);
  });

  it('replaces the optimistic record with the merged one the repository keeps', async () => {
    const record = fakeRecord(() => ({
      schemaVersion: 1,
      panelFirstOpenedAt: EARLIER,
      welcomeShownAt: EARLIER,
    }));
    recordOnboardingMoment(record, 'panelFirstOpenedAt');
    await flush();
    expect(onboardingStore.getState().record).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: EARLIER,
      welcomeShownAt: EARLIER,
    });
  });

  it('writes nothing for a moment the store already holds', () => {
    onboardingStore
      .getState()
      .setRecord({ schemaVersion: 1, entryToastOptOutAt: EARLIER });
    const record = fakeRecord((fields) => ({ schemaVersion: 1, ...fields }));
    recordOnboardingMoment(record, 'entryToastOptOutAt');
    expect(record.patch).not.toHaveBeenCalled();
  });

  it('keeps the optimistic moment when the write fails', async () => {
    const record = {
      patch: vi.fn(() => Promise.reject(new Error('quota'))),
    };
    recordOnboardingMoment(record, 'panelFirstOpenedAt');
    await flush();
    expect(onboardingStore.getState().record.panelFirstOpenedAt).toBeDefined();
  });
});
