// Prints the fingerprint of saved host app bundles for the host check (ADR-0079), with
// the same extraction the background worker runs, so the recorded table and the worker
// never fork. It reads each bundle as text and evaluates none of it. For each bundle it
// prints every part's hash and whether the bundle matches a build in
// src/lib/regis/fingerprint/recorded.ts, then prints the bundles grouped by identical
// fingerprints as entries for that table. With --prove it also applies each synthetic
// edit in src/lib/regis/fingerprint/probes.ts to every bundle and fails unless each edit
// changes the part it is in, and applies each neutral edit of the App shell in
// src/lib/regis/fingerprint/shellProbes.ts and fails unless each changes no part. Run it
// on a new build after a review:
//
//   node scripts/host-fingerprint.mjs [--prove] path/to/app.<hash>.js ...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  compareFingerprint,
  fingerprintScript,
} from '../src/lib/regis/fingerprint/fingerprint.ts';
import { PART_IDS } from '../src/lib/regis/fingerprint/partIds.ts';
import { PROBES } from '../src/lib/regis/fingerprint/probes.ts';
import { RECORDED_BUILDS } from '../src/lib/regis/fingerprint/recorded.ts';
import { NEUTRAL_EDITS } from '../src/lib/regis/fingerprint/shellProbes.ts';
import { WRITE_DIGESTS } from '../src/lib/regis/fingerprint/writes.ts';

const args = process.argv.slice(2);
const prove = args.includes('--prove');
const paths = args.filter((arg) => arg !== '--prove');
if (paths.length === 0) {
  console.error('host fingerprint: name at least one saved app bundle');
  process.exit(1);
}

let failed = false;
const groups = new Map();

for (const path of paths) {
  const name = basename(path);
  const source = readFileSync(path, 'utf8');
  const fingerprint = await fingerprintScript(source);
  if (fingerprint === null) {
    console.log(`${name}: unreadable`);
    failed = true;
    continue;
  }
  const verdict = compareFingerprint(fingerprint, RECORDED_BUILDS);
  console.log(
    `${name}: ${
      verdict.status === 'verified'
        ? `matches the recorded ${verdict.build}`
        : `differs from every recorded build in ${verdict.parts.join(', ')}`
    }`,
  );
  for (const part of PART_IDS) {
    console.log(`  ${part.padEnd(14)} ${fingerprint[part] ?? 'absent'}`);
  }
  const key = JSON.stringify(fingerprint);
  groups.set(key, [...(groups.get(key) ?? []), name]);
  if (!prove) continue;
  for (const probe of PROBES) {
    const edited = await probe.apply(source, WRITE_DIGESTS);
    if (edited === null) {
      console.log(`  probe ${probe.id}: no anchor in this bundle`);
      continue;
    }
    const after = await fingerprintScript(edited);
    const changed =
      after === null
        ? ['unreadable']
        : PART_IDS.filter((part) => after[part] !== fingerprint[part]);
    const flips = after === null || changed.includes(probe.part);
    if (!flips) failed = true;
    console.log(
      `  probe ${probe.id} (${probe.describe}): ${flips ? 'changes' : 'MISSED'} ${changed.join(', ')}`,
    );
  }
  for (const edit of NEUTRAL_EDITS) {
    const edited = await edit.apply(source, WRITE_DIGESTS);
    if (edited === null) {
      console.log(`  neutral ${edit.id}: no anchor in this bundle`);
      continue;
    }
    const after = await fingerprintScript(edited);
    const changed =
      after === null
        ? ['unreadable']
        : PART_IDS.filter((part) => after[part] !== fingerprint[part]);
    if (changed.length > 0) failed = true;
    console.log(
      `  neutral ${edit.id} (${edit.describe}): ${
        changed.length === 0
          ? 'keeps every part'
          : `CHANGED ${changed.join(', ')}`
      }`,
    );
  }
}

console.log('\nEntries for recorded.ts:');
for (const [key, builds] of groups) {
  console.log(JSON.stringify({ builds, parts: JSON.parse(key) }, null, 2));
}
if (failed) process.exit(1);
