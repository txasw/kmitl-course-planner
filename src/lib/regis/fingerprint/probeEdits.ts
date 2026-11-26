// The edits the synthetic probes make to a saved host bundle (ADR-0079): a token
// replaced or text inserted after one, at a token the probe finds. Nothing here ships.

import type { Bundle, Span } from './module.ts';
import type { PartId } from './partIds.ts';

export interface NeutralEdit {
  id: string;
  describe: string;
  /** The bundle with the edit, or null when its anchor is not in this bundle. */
  apply: (
    source: string,
    writeDigests: ReadonlySet<string>,
  ) => Promise<string | null> | string | null;
}

export interface Probe extends NeutralEdit {
  /** The part the edit is in, whose fingerprint must change. */
  part: PartId;
}

export function replaceAt(
  source: string,
  bundle: Bundle,
  index: number,
  value: string,
): string | null {
  const token = bundle.tokens[index];
  if (token === undefined || index < 0) return null;
  return (
    source.slice(0, token.start) +
    value +
    source.slice(token.start + token.text.length)
  );
}

export function insertAfter(
  source: string,
  bundle: Bundle,
  index: number,
  value: string,
): string | null {
  const token = bundle.tokens[index];
  if (token === undefined || index < 0) return null;
  const end = token.start + token.text.length;
  return source.slice(0, end) + value + source.slice(end);
}

export function firstIn(span: Span, test: (index: number) => boolean): number {
  for (let index = span.start; index < span.end; index += 1) {
    if (test(index)) return index;
  }
  return -1;
}
