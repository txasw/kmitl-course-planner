import { describe, expect, it } from 'vitest';
import { sha256 } from './digest';
import { readBundle } from './module';
import { WRITE_DIGESTS, writeReferences } from './writes';

describe('writeReferences', () => {
  it('finds the value of a function key whose digest it is given', async () => {
    const bundle = readBundle(
      'x={function:"sample-write"},y={function:"sample-read"},z={name:"sample-write"};',
    );
    const found = await writeReferences(
      bundle,
      new Set([await sha256('sample-write')]),
    );
    expect(found.map((index) => bundle.tokens[index]?.text)).toEqual([
      '"sample-write"',
    ]);
  });

  it('knows the seven write endpoints by digest alone', () => {
    expect(WRITE_DIGESTS.size).toBe(7);
    for (const digest of WRITE_DIGESTS)
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
