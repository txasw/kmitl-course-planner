// Where the host bundle names a registration write endpoint (ADR-0079). KCP never calls
// one, and no KCP source or bundle names one (tests/scripts/write-names.test.ts), so the
// endpoints are known here only by the SHA-256 of their function names. A reference is
// a string that is the value of a `function` key, as the host's API services pass it,
// whose digest is one of these. The literal is read from the bundle, in memory, and the
// write part's text is each method that holds one.

import { sha256 } from './digest.ts';
import { text } from './locate.ts';
import type { Bundle } from './module.ts';

/** The digests of the seven registration write function names. */
export const WRITE_DIGESTS: ReadonlySet<string> = new Set([
  'abe1bba5c7762a34447d32f905ffebb1f139adc8171dedf0e00d2c56ab3cff3b',
  '45390165fce0bae9bf04313a098b2a42d5d727bf90d4be040f01ec0f7fee969d',
  'adfcc333a5923c4e50269418197ac107d0a2d289fbea4660c364ffb5d70c0573',
  'ec95e801db7591231208e6aa872d7721d95010900207fc59f9115b70cb3a4324',
  'ebc5cff5ec887976292240868979068b7fcde2a9830855236501d9c142d9b395',
  'f3dc0b52481ee141ad36f33863051c7d7776bb7040e01b39f95a3dc30682bf23',
  '09729e525b93e6227f06200b7d377ed2b7dc67e97ca3b631159ba509412093e3',
]);

/** The token index of every write endpoint reference, in bundle order. */
export async function writeReferences(
  bundle: Bundle,
  digests: ReadonlySet<string> = WRITE_DIGESTS,
): Promise<number[]> {
  const byLiteral = new Map<string, number[]>();
  bundle.tokens.forEach((token, index) => {
    if (
      token.kind === 'string' &&
      text(bundle, index - 1) === ':' &&
      text(bundle, index - 2) === 'function'
    ) {
      byLiteral.set(token.text, [...(byLiteral.get(token.text) ?? []), index]);
    }
  });
  const found: number[] = [];
  for (const [literal, indices] of byLiteral) {
    if (digests.has(await sha256(literal.slice(1, -1)))) found.push(...indices);
  }
  return found.sort((left, right) => left - right);
}
