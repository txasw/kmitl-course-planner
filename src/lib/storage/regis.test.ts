import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import type { RegistrationKit } from '../regis/kitSchema';
import type { ChecklistMarks } from '../regis/checklist';
import { CHECKLIST_KEY, FILL_KEY, REGKIT_KEY } from './keys';
import {
  createChecklistRepository,
  createFillSettingsRepository,
  createRegKitRepository,
  REGIS_RECORD_LIMIT,
} from './regis';

const NOW = '2026-11-23T05:00:00.000Z';

function kit(planId: string): RegistrationKit {
  return {
    planId,
    year: '2569',
    semester: '2',
    preparedAt: '2026-11-22T14:10:00.000Z',
    subjects: [],
    unread: [],
  };
}

function marks(planId: string): ChecklistMarks {
  return {
    planId,
    year: '2569',
    semester: '2',
    marks: { '01476107': { state: 'added', at: NOW } },
  };
}

describe('registration kit repository', () => {
  it('loads nothing from an empty store and keeps one kit per plan', async () => {
    const storage = createMemoryStorage();
    const repo = createRegKitRepository(storage, () => NOW);
    expect(await repo.load()).toEqual([]);
    await repo.put('a', kit('a'));
    await repo.put('b', kit('b'));
    const next = { ...kit('a'), preparedAt: NOW };
    expect((await repo.put('a', next)).map((item) => item.planId)).toEqual([
      'a',
      'b',
    ]);
    expect((await repo.load())[0]?.preparedAt).toBe(NOW);
    expect(await repo.put('a', null)).toEqual([kit('b')]);
  });

  it('keeps only the most recent kits', async () => {
    const repo = createRegKitRepository(createMemoryStorage(), () => NOW);
    for (let index = 0; index <= REGIS_RECORD_LIMIT; index += 1) {
      await repo.put(`p${String(index)}`, kit(`p${String(index)}`));
    }
    const items = await repo.load();
    expect(items).toHaveLength(REGIS_RECORD_LIMIT);
    expect(items[0]?.planId).toBe(`p${String(REGIS_RECORD_LIMIT)}`);
  });

  it('moves a bad kit aside and keeps the rest', async () => {
    const storage = createMemoryStorage({
      [REGKIT_KEY]: { schemaVersion: 1, items: [kit('a'), { planId: 3 }] },
    });
    const repo = createRegKitRepository(storage, () => NOW);
    expect(await repo.load()).toEqual([kit('a')]);
    expect(storage.store[`kcp:quarantine:regkit:${NOW}`]).toEqual([
      { planId: 3 },
    ]);
    expect(storage.store[REGKIT_KEY]).toEqual({
      schemaVersion: 1,
      items: [kit('a')],
    });
  });

  it('moves a malformed root aside whole', async () => {
    const storage = createMemoryStorage({ [REGKIT_KEY]: 'garbage' });
    const repo = createRegKitRepository(storage, () => NOW);
    expect(await repo.load()).toEqual([]);
    expect(storage.store[`kcp:quarantine:regkit:${NOW}`]).toBe('garbage');
    expect(storage.store[REGKIT_KEY]).toBeUndefined();
  });

  it('refuses a newer schema and never overwrites it', async () => {
    const newer = { schemaVersion: 2, items: [{ future: true }] };
    const storage = createMemoryStorage({ [REGKIT_KEY]: newer });
    const repo = createRegKitRepository(storage, () => NOW);
    expect(await repo.load()).toEqual([]);
    await repo.put('a', kit('a'));
    expect(storage.store[REGKIT_KEY]).toEqual(newer);
  });
});

describe('checklist repository', () => {
  it('stores marks per plan under its own key', async () => {
    const storage = createMemoryStorage();
    const repo = createChecklistRepository(storage, () => NOW);
    await repo.put('a', marks('a'));
    expect(storage.store[CHECKLIST_KEY]).toEqual({
      schemaVersion: 1,
      items: [marks('a')],
    });
    expect(await repo.load()).toEqual([marks('a')]);
  });

  it('drops a mark of an unknown state into quarantine', async () => {
    const bad = {
      ...marks('b'),
      marks: { x: { state: 'submitted', at: NOW } },
    };
    const storage = createMemoryStorage({
      [CHECKLIST_KEY]: { schemaVersion: 1, items: [bad, marks('a')] },
    });
    const repo = createChecklistRepository(storage, () => NOW);
    expect(await repo.load()).toEqual([marks('a')]);
    expect(storage.store[`kcp:quarantine:checklist:${NOW}`]).toEqual([bad]);
  });
});

describe('fill settings repository', () => {
  it('starts with fill on and nothing latched, and keeps what is saved', async () => {
    const storage = createMemoryStorage();
    const repo = createFillSettingsRepository(storage);
    expect(await repo.load()).toEqual({ off: false, latched: [] });
    await repo.save({ off: true, latched: ['app.454d9e95.js'] });
    expect(await repo.load()).toEqual({
      off: true,
      latched: ['app.454d9e95.js'],
    });
  });

  it('falls back to the defaults on a blob that does not validate', async () => {
    const storage = createMemoryStorage();
    await storage.set(FILL_KEY, { off: 'yes' });
    expect(await createFillSettingsRepository(storage).load()).toEqual({
      off: false,
      latched: [],
    });
  });
});
