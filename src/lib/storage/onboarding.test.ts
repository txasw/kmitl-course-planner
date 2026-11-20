import { describe, expect, it } from 'vitest';
import {
  createOnboardingRepository,
  type OnboardingRecord,
} from './onboarding';
import { ONBOARDING_KEY } from './keys';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const FIRST = '2026-11-06T08:00:00.000Z';
const LATER = '2026-11-07T09:30:00.000Z';

describe('onboarding repository', () => {
  it('loads an absent blob as an empty record', async () => {
    const repo = createOnboardingRepository(createMemoryStorage());
    expect(await repo.load()).toEqual({ schemaVersion: 1 });
  });

  it.each([
    ['a wrong schema version', { schemaVersion: 2, welcomeShownAt: FIRST }],
    ['a value that is not an object', 'shown'],
  ])('loads %s as an empty record', async (_label, blob) => {
    const repo = createOnboardingRepository(
      createMemoryStorage({ [ONBOARDING_KEY]: blob }),
    );
    expect(await repo.load()).toEqual({ schemaVersion: 1 });
  });

  it('loads a full record', async () => {
    const record: OnboardingRecord = {
      schemaVersion: 1,
      welcomeShownAt: FIRST,
      panelFirstOpenedAt: LATER,
      entryToastOptOutAt: LATER,
    };
    const repo = createOnboardingRepository(
      createMemoryStorage({ [ONBOARDING_KEY]: record }),
    );
    expect(await repo.load()).toEqual(record);
  });

  it('drops one bad field alone and keeps the others', async () => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: {
          schemaVersion: 1,
          welcomeShownAt: 'not a time',
          panelFirstOpenedAt: FIRST,
          entryToastOptOutAt: 42,
        },
      }),
    );
    const loaded = await repo.load();
    expect(loaded.welcomeShownAt).toBeUndefined();
    expect(loaded.entryToastOptOutAt).toBeUndefined();
    expect(loaded.panelFirstOpenedAt).toBe(FIRST);
  });

  it('writes a patched field and resolves the merged record', async () => {
    const storage = createMemoryStorage();
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ welcomeShownAt: FIRST });
    expect(merged).toEqual({ schemaVersion: 1, welcomeShownAt: FIRST });
    expect(storage.store[ONBOARDING_KEY]).toEqual(merged);
  });

  it('never overwrites a timestamp that is already set', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, welcomeShownAt: FIRST },
    });
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ welcomeShownAt: LATER });
    expect(merged.welcomeShownAt).toBe(FIRST);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('re-reads before merging so two tabs never erase each other', async () => {
    const storage = createMemoryStorage();
    const firstTab = createOnboardingRepository(storage);
    const secondTab = createOnboardingRepository(storage);
    await firstTab.load();
    await secondTab.patch({ panelFirstOpenedAt: FIRST });
    const merged = await firstTab.patch({ welcomeShownAt: LATER });
    expect(merged).toEqual({
      schemaVersion: 1,
      welcomeShownAt: LATER,
      panelFirstOpenedAt: FIRST,
    });
    expect(storage.store[ONBOARDING_KEY]).toEqual(merged);
  });

  it('runs overlapping patches from one document in order', async () => {
    const storage = createMemoryStorage();
    const repo = createOnboardingRepository(storage);
    const [first, second] = await Promise.all([
      repo.patch({ welcomeShownAt: FIRST }),
      repo.patch({ entryToastOptOutAt: LATER }),
    ]);
    expect(first).toEqual({ schemaVersion: 1, welcomeShownAt: FIRST });
    expect(second).toEqual({
      schemaVersion: 1,
      welcomeShownAt: FIRST,
      entryToastOptOutAt: LATER,
    });
  });

  it('keeps patching after a write fails', async () => {
    const storage = createMemoryStorage();
    storage.set.mockRejectedValueOnce(new Error('quota'));
    const repo = createOnboardingRepository(storage);
    await expect(repo.patch({ welcomeShownAt: FIRST })).rejects.toThrow(
      'quota',
    );
    expect(await repo.patch({ welcomeShownAt: LATER })).toEqual({
      schemaVersion: 1,
      welcomeShownAt: LATER,
    });
  });
});

describe('the coach mark snooze day', () => {
  it('loads a record written before the day existed as version 1', async () => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: { schemaVersion: 1, welcomeShownAt: FIRST },
      }),
    );
    expect(await repo.load()).toEqual({
      schemaVersion: 1,
      welcomeShownAt: FIRST,
    });
  });

  it.each([
    ['a timestamp', FIRST],
    ['a day out of range', '2026-13-40'],
    ['a number', 20261120],
  ])('drops %s alone', async (_label, value) => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: {
          schemaVersion: 1,
          panelFirstOpenedAt: FIRST,
          coachMarkSnoozedOn: value,
        },
      }),
    );
    expect(await repo.load()).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: FIRST,
    });
  });

  it('replaces an earlier day with a later one', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, coachMarkSnoozedOn: '2026-11-19' },
    });
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ coachMarkSnoozedOn: '2026-11-20' });
    expect(merged.coachMarkSnoozedOn).toBe('2026-11-20');
    expect(storage.store[ONBOARDING_KEY]).toEqual(merged);
  });

  it('replaces a later day, which only a clock set ahead leaves', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, coachMarkSnoozedOn: '2030-01-01' },
    });
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ coachMarkSnoozedOn: '2026-11-20' });
    expect(merged.coachMarkSnoozedOn).toBe('2026-11-20');
    expect(storage.store[ONBOARDING_KEY]).toEqual(merged);
  });

  it('writes nothing when the same day is stored already', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, coachMarkSnoozedOn: '2026-11-20' },
    });
    const repo = createOnboardingRepository(storage);
    await repo.patch({ coachMarkSnoozedOn: '2026-11-20' });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('carries the day through a patch of another field', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, coachMarkSnoozedOn: '2026-11-20' },
    });
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ panelFirstOpenedAt: FIRST });
    expect(merged).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: FIRST,
      coachMarkSnoozedOn: '2026-11-20',
    });
  });
});

describe('the product tour mark', () => {
  const MARK = { version: 1, outcome: 'completed', at: FIRST } as const;

  it('loads a record written before the mark existed as version 1', async () => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: { schemaVersion: 1, welcomeShownAt: FIRST },
      }),
    );
    expect((await repo.load()).tourSeen).toBeUndefined();
  });

  it('loads a valid mark', async () => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: { schemaVersion: 1, tourSeen: MARK },
      }),
    );
    expect((await repo.load()).tourSeen).toEqual(MARK);
  });

  it.each([
    ['a version that is not a positive whole number', { ...MARK, version: 0 }],
    ['an unknown outcome', { ...MARK, outcome: 'closed' }],
    ['a time that does not parse', { ...MARK, at: 'yesterday' }],
    ['a string', 'seen'],
  ])('drops %s alone', async (_label, value) => {
    const repo = createOnboardingRepository(
      createMemoryStorage({
        [ONBOARDING_KEY]: {
          schemaVersion: 1,
          panelFirstOpenedAt: FIRST,
          tourSeen: value,
        },
      }),
    );
    expect(await repo.load()).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: FIRST,
    });
  });

  it('replaces an earlier mark with the latest one', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: {
        schemaVersion: 1,
        tourSeen: { ...MARK, outcome: 'skipped' },
      },
    });
    const repo = createOnboardingRepository(storage);
    const later = { ...MARK, at: LATER };
    const merged = await repo.patch({ tourSeen: later });
    expect(merged.tourSeen).toEqual(later);
    expect(storage.store[ONBOARDING_KEY]).toEqual(merged);
  });

  it('writes nothing when the same mark is stored already', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, tourSeen: MARK },
    });
    const repo = createOnboardingRepository(storage);
    await repo.patch({ tourSeen: { ...MARK } });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('carries the mark through a patch of another field', async () => {
    const storage = createMemoryStorage({
      [ONBOARDING_KEY]: { schemaVersion: 1, tourSeen: MARK },
    });
    const repo = createOnboardingRepository(storage);
    const merged = await repo.patch({ panelFirstOpenedAt: FIRST });
    expect(merged).toEqual({
      schemaVersion: 1,
      panelFirstOpenedAt: FIRST,
      tourSeen: MARK,
    });
  });
});
