// The host check messages (ADR-0079): the request the helper sends with the page's two
// public script names, and the verdict the worker answers with. They live with the
// registration code rather than in the core protocol, so a program that carries only
// the core messages reaches none of it; the extension protocol composes them in.

import { z } from 'zod';
import type { Result } from '../utils/result';
import { hostBuildVerdictSchema, type HostBuildVerdict } from './buildVerdict';
import { APP_SCRIPT_NAME, VENDOR_SCRIPT_NAME } from './hostContract';

// The host check takes the page's two public script names, each held to its pattern
// here and again in the worker, which builds the address itself.
export const hostBuildRequestSchema = z.object({
  type: z.literal('regis/hostBuild'),
  app: z.string().regex(APP_SCRIPT_NAME),
  vendors: z.string().regex(VENDOR_SCRIPT_NAME),
});

/** The response payload of the host check, keyed by its discriminant. */
export interface RegisResponseMap {
  'regis/hostBuild': Result<HostBuildVerdict>;
}

/**
 * The successful regis/hostBuild reply, checked on receipt, so an error Result and a
 * malformed reply alike leave the build untested.
 */
export const hostBuildReplySchema = z.object({
  ok: z.literal(true),
  value: hostBuildVerdictSchema,
});
