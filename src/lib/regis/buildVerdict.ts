// The host check's verdict on the page's build (ADR-0079), the one shape the worker
// answers with and the helper reads. Tested is the exact script name pair KCP was tested
// against. Verified is an app script whose every part's fingerprint equals a tested
// build's, beside a tested vendor script. Every other verdict keeps fill off with the
// untested build sentence: a part that differs, a script KCP could not read, a check
// that could not run, or a vendor script KCP was not tested with.

import { z } from 'zod';
import { PART_IDS } from './fingerprint/partIds';

export const hostBuildVerdictSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('tested') }),
  z.object({ status: z.literal('verified') }),
  z.object({
    status: z.literal('mismatch'),
    parts: z.array(z.enum(PART_IDS)).max(PART_IDS.length),
  }),
  z.object({ status: z.literal('unreadable') }),
  z.object({ status: z.literal('failed') }),
  z.object({ status: z.literal('untestedVendor') }),
]);

export type HostBuildVerdict = z.infer<typeof hostBuildVerdictSchema>;

/** Whether a verdict lets the observer and fill treat the build as tested. */
export function isTrusted(verdict: HostBuildVerdict): boolean {
  return verdict.status === 'tested' || verdict.status === 'verified';
}
