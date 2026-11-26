import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import { HOST_CHECK_KEY } from './keys';
import { HOST_CHECK_LIMIT, createHostCheckRepository } from './hostChecks';

const HASH = 'a'.repeat(64);

describe('host check repository', () => {
  it('keeps what was read for each app script by its name', async () => {
    const storage = createMemoryStorage();
    const repo = createHostCheckRepository(storage);
    expect(await repo.load('app.0000000a.js')).toBeNull();
    await repo.save('app.0000000a.js', {
      kind: 'read',
      parts: { route: HASH },
    });
    await repo.save('app.0000000b.js', { kind: 'unreadable' });
    expect(await repo.load('app.0000000a.js')).toEqual({
      kind: 'read',
      parts: { route: HASH },
    });
    expect(await repo.load('app.0000000b.js')).toEqual({ kind: 'unreadable' });
  });

  it('keeps the newest entries up to its limit', async () => {
    const storage = createMemoryStorage();
    const repo = createHostCheckRepository(storage);
    for (let index = 0; index <= HOST_CHECK_LIMIT; index += 1) {
      await repo.save(`app.${index.toString(16).padStart(8, '0')}.js`, {
        kind: 'failed',
        at: index,
      });
    }
    expect(await repo.load('app.00000000.js')).toBeNull();
    expect(await repo.load('app.00000008.js')).toEqual({
      kind: 'failed',
      at: 8,
    });
  });

  it('ignores an entry of another fingerprint version', async () => {
    const storage = createMemoryStorage({
      [HOST_CHECK_KEY]: {
        schemaVersion: 1,
        entries: [
          {
            app: 'app.0000000a.js',
            version: 0,
            result: { kind: 'unreadable' },
          },
        ],
      },
    });
    expect(
      await createHostCheckRepository(storage).load('app.0000000a.js'),
    ).toBeNull();
  });

  it.each([
    ['a value that is not the record', 'nope'],
    [
      'an entry whose hash is not hex',
      {
        schemaVersion: 1,
        entries: [
          {
            app: 'app.0000000a.js',
            version: 1,
            result: { kind: 'read', parts: { route: 'zz' } },
          },
        ],
      },
    ],
    [
      'an entry whose name is not an app script',
      {
        schemaVersion: 1,
        entries: [
          {
            app: 'https://x/app.js',
            version: 1,
            result: { kind: 'unreadable' },
          },
        ],
      },
    ],
    [
      'an unknown part',
      {
        schemaVersion: 1,
        entries: [
          {
            app: 'app.0000000a.js',
            version: 1,
            result: { kind: 'read', parts: { other: HASH } },
          },
        ],
      },
    ],
  ])('reads nothing from %s and writes over it', async (_name, blob) => {
    const storage = createMemoryStorage({ [HOST_CHECK_KEY]: blob });
    const repo = createHostCheckRepository(storage);
    expect(await repo.load('app.0000000a.js')).toBeNull();
    await repo.save('app.0000000c.js', { kind: 'unreadable' });
    expect(await repo.load('app.0000000c.js')).toEqual({ kind: 'unreadable' });
  });
});
