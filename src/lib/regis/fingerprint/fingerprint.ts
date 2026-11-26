// The fingerprint of a host app bundle (ADR-0079): the SHA-256 of each part's canonical
// text, and whether it equals the fingerprint recorded from a build KCP was tested
// against. A bundle KCP cannot tokenize, or whose page components it cannot place in one
// module, has no fingerprint. A fingerprint matches a recorded build only when it has
// the same parts and every part's hash is equal; otherwise the verdict names the parts
// that differ from the closest recorded build, for the debug build's diagnostics.

import { sha256 } from './digest.ts';
import { labelsText } from './labels.ts';
import { readBundle, type Bundle } from './module.ts';
import { PART_IDS, locateParts, type PartId } from './parts.ts';
import { TokenError } from './tokens.ts';
import { WRITE_DIGESTS, writeReferences } from './writes.ts';

/**
 * The version of the extraction and the canonical text. A change to either changes
 * every fingerprint, so the recorded table and any stored fingerprint are of a version.
 */
export const FINGERPRINT_VERSION = 1;

export type Fingerprint = Partial<Record<PartId, string>>;

export interface RecordedBuild {
  /** The app script names of the tested builds that share this fingerprint. */
  builds: readonly string[];
  parts: Fingerprint;
}

export type FingerprintVerdict =
  | { status: 'verified'; build: string }
  | { status: 'mismatch'; parts: PartId[] };

/** The canonical text of each part found in an app bundle, or null when unreadable. */
export async function partTexts(
  source: string,
  writeDigests: ReadonlySet<string> = WRITE_DIGESTS,
): Promise<Partial<Record<PartId, string>> | null> {
  let bundle: Bundle;
  try {
    bundle = readBundle(source);
  } catch (error) {
    if (error instanceof TokenError) return null;
    throw error;
  }
  const located = locateParts(
    bundle,
    await writeReferences(bundle, writeDigests),
  );
  if (located === null) return null;
  const texts: Partial<Record<PartId, string>> = { ...located.texts };
  texts.labels = labelsText(
    bundle,
    located.module,
    source,
    located.catalogs,
    Object.values(located.texts),
  );
  return texts;
}

/**
 * The fingerprint of an app bundle, or null when KCP cannot read it. The write digests
 * are the registration write endpoints; a test passes its own to see a write it names.
 */
export async function fingerprintScript(
  source: string,
  writeDigests: ReadonlySet<string> = WRITE_DIGESTS,
): Promise<Fingerprint | null> {
  const texts = await partTexts(source, writeDigests);
  if (texts === null) return null;
  const fingerprint: Fingerprint = {};
  for (const part of PART_IDS) {
    const text = texts[part];
    if (text !== undefined) fingerprint[part] = await sha256(text);
  }
  return fingerprint;
}

/** The parts whose hash or presence differs between two fingerprints. */
function differing(left: Fingerprint, right: Fingerprint): PartId[] {
  return PART_IDS.filter((part) => left[part] !== right[part]);
}

/** Whether a fingerprint equals a recorded build's, and if not, which parts differ. */
export function compareFingerprint(
  fingerprint: Fingerprint,
  recorded: readonly RecordedBuild[],
): FingerprintVerdict {
  let closest: PartId[] | null = null;
  for (const build of recorded) {
    const parts = differing(fingerprint, build.parts);
    if (parts.length === 0) {
      return { status: 'verified', build: build.builds[0] ?? '' };
    }
    if (closest === null || parts.length < closest.length) closest = parts;
  }
  return { status: 'mismatch', parts: closest ?? [...PART_IDS] };
}
