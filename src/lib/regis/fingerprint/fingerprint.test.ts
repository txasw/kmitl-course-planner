import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TESTED_BUILDS } from '../hostContract';
import { REPLICA_BUILD } from '../../api/debug/replicaBuild';
import { sha256 } from './digest';
import {
  FINGERPRINT_VERSION,
  compareFingerprint,
  fingerprintScript,
  partTexts,
  type RecordedBuild,
} from './fingerprint';
import { PART_IDS } from './partIds';
import { PROBES } from './probes';
import { RECORDED_BUILDS } from './recorded';

// The replica bundle is KCP's own stand in for the host's app script, shaped as the
// host's build emits it, with every part the companion depends on. It names no real
// write endpoint, so a test that needs one passes the digest of a replica name.
const REPLICA = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/host-fingerprint/app.replica.js'),
  'utf8',
);
const REPLICA_WRITE = 'replica-send-list';

async function replicaDigests(): Promise<ReadonlySet<string>> {
  return new Set([await sha256(REPLICA_WRITE)]);
}

describe('fingerprintScript on the replica bundle', () => {
  it('finds every part and matches the replica build the debug build records', async () => {
    const fingerprint = await fingerprintScript(REPLICA);
    expect(Object.keys(fingerprint ?? {}).sort()).toEqual([...PART_IDS].sort());
    expect(compareFingerprint(fingerprint ?? {}, [REPLICA_BUILD])).toEqual({
      status: 'verified',
      build: 'app.replica.js',
    });
  });

  it('reads the same after a function is renamed and its locals with it', async () => {
    const helper =
      'function Ql(A,e){return A.some((A=>e.some((e=>A.day===e.day&&A.start<e.end&&e.start<A.end))))}';
    expect(REPLICA).toContain(helper);
    const renamed = REPLICA.replace(
      helper,
      'function Ql(x,y){return x.some((z=>y.some((w=>z.day===w.day&&z.start<w.end&&w.start<z.end))))}',
    ).replaceAll('Ql(', 'Zq(');
    expect(await fingerprintScript(renamed)).toEqual(
      await fingerprintScript(REPLICA),
    );
  });

  it('sees a swap of two bindings in a helper the card calls', async () => {
    const swapped = REPLICA.replace('e.start<A.end', 'A.start<e.end');
    const before = await fingerprintScript(REPLICA);
    const after = await fingerprintScript(swapped);
    expect(after?.addSubject).not.toBe(before?.addSubject);
    expect(after?.panel).toBe(before?.panel);
  });

  it('reads the write part from the methods that name a write endpoint', async () => {
    const digests = await replicaDigests();
    const texts = await partTexts(REPLICA, digests);
    expect(texts?.writes).toContain('"replica-send-list"');
    expect(texts?.writes).toContain('async sendList');
    expect((await partTexts(REPLICA))?.writes).toBe('');
  });

  it.each(PROBES.map((probe) => [probe.id, probe] as const))(
    'sees the synthetic edit %s in its part',
    async (_id, probe) => {
      const digests = await replicaDigests();
      const edited = await probe.apply(REPLICA, digests);
      expect(edited).not.toBeNull();
      const before = await fingerprintScript(REPLICA, digests);
      const after = await fingerprintScript(edited ?? '', digests);
      expect(after?.[probe.part]).toBeDefined();
      expect(after?.[probe.part]).not.toBe(before?.[probe.part]);
    },
  );

  it('has no fingerprint for a script it cannot read', async () => {
    expect(await fingerprintScript('var a="unclosed')).toBeNull();
    expect(await fingerprintScript('var a=1;')).toBeNull();
  });

  it('leaves out a part it cannot find, and the comparison names it', async () => {
    const without = REPLICA.replace('name:"PreRegisStepper"', 'name:"Other"');
    const fingerprint = await fingerprintScript(without);
    expect(fingerprint?.stepper).toBeUndefined();
    const verdict = compareFingerprint(fingerprint ?? {}, [REPLICA_BUILD]);
    expect(verdict.status).toBe('mismatch');
    expect(verdict.status === 'mismatch' && verdict.parts).toContain('stepper');
  });

  it('cannot place a page component defined twice', async () => {
    const twice = `${REPLICA};var Zz={name:"PreRegisAddSubject"};`;
    expect((await fingerprintScript(twice))?.addSubject).toBeUndefined();
  });
});

describe('compareFingerprint', () => {
  const recorded: RecordedBuild[] = [
    { builds: ['app.00000001.js'], parts: { route: 'a', panel: 'b' } },
    {
      builds: ['app.00000002.js'],
      parts: { route: 'a', panel: 'c', header: 'd' },
    },
  ];

  it('matches a recorded build only with the same parts and hashes', () => {
    expect(compareFingerprint({ route: 'a', panel: 'b' }, recorded)).toEqual({
      status: 'verified',
      build: 'app.00000001.js',
    });
    expect(
      compareFingerprint({ route: 'a', panel: 'b', header: 'd' }, recorded),
    ).toEqual({ status: 'mismatch', parts: ['header'] });
  });

  it('names the parts that differ from the closest recorded build', () => {
    expect(
      compareFingerprint({ route: 'x', panel: 'c', header: 'd' }, recorded),
    ).toEqual({ status: 'mismatch', parts: ['route'] });
  });

  it('names every part when nothing is recorded', () => {
    expect(compareFingerprint({}, [])).toEqual({
      status: 'mismatch',
      parts: [...PART_IDS],
    });
  });
});

describe('RECORDED_BUILDS', () => {
  it('records each tested app build exactly once, with full hashes', () => {
    const builds = RECORDED_BUILDS.flatMap((build) => build.builds);
    expect(new Set(builds).size).toBe(builds.length);
    expect([...builds].sort()).toEqual(
      [...new Set(TESTED_BUILDS.map(([app]) => app))].sort(),
    );
    for (const build of RECORDED_BUILDS) {
      for (const hash of Object.values(build.parts)) {
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it('is of the current fingerprint version', () => {
    expect(FINGERPRINT_VERSION).toBe(1);
  });
});
