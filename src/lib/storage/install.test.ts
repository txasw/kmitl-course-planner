import { describe, expect, it } from 'vitest';
import { createInstallRepository, type InstallRecord } from './install';
import { INSTALL_KEY } from './keys';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const INSTALLED_AT = '2026-11-06T08:00:00.000Z';
const stored: InstallRecord = {
  schemaVersion: 1,
  installedAt: INSTALLED_AT,
  version: '1.3.1',
};

describe('install repository', () => {
  it('loads a stored record', async () => {
    const repo = createInstallRepository(
      createMemoryStorage({ [INSTALL_KEY]: stored }),
    );
    expect(await repo.load()).toEqual(stored);
  });

  it('loads an absent blob as null', async () => {
    const repo = createInstallRepository(createMemoryStorage());
    expect(await repo.load()).toBeNull();
  });

  it.each([
    ['a wrong schema version', { ...stored, schemaVersion: 2 }],
    ['a timestamp that is not ISO', { ...stored, installedAt: 'yesterday' }],
    ['an empty version', { ...stored, version: '' }],
    ['a value that is not an object', 'installed'],
  ])('loads %s as null', async (_label, blob) => {
    const repo = createInstallRepository(
      createMemoryStorage({ [INSTALL_KEY]: blob }),
    );
    expect(await repo.load()).toBeNull();
  });

  it('writes the record on an absent key and reports it created', async () => {
    const storage = createMemoryStorage();
    const repo = createInstallRepository(storage, { now: () => INSTALLED_AT });
    expect(await repo.record('1.3.1')).toEqual({ created: true });
    expect(storage.store[INSTALL_KEY]).toEqual(stored);
    expect(await repo.load()).toEqual(stored);
  });

  it('writes nothing over an existing record and reports it not created', async () => {
    const storage = createMemoryStorage({ [INSTALL_KEY]: stored });
    const repo = createInstallRepository(storage, {
      now: () => '2027-01-01T00:00:00.000Z',
    });
    expect(await repo.record('1.4.0')).toEqual({ created: false });
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.store[INSTALL_KEY]).toEqual(stored);
  });

  it('replaces a malformed blob so content can read the install', async () => {
    const storage = createMemoryStorage({ [INSTALL_KEY]: { broken: true } });
    const repo = createInstallRepository(storage, { now: () => INSTALLED_AT });
    expect(await repo.record('1.3.1')).toEqual({ created: true });
    expect(await repo.load()).toEqual(stored);
  });

  it('stamps the current time by default', async () => {
    const repo = createInstallRepository(createMemoryStorage());
    await repo.record('1.3.1');
    const loaded = await repo.load();
    expect(loaded?.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
