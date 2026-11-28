// The debug namespace of the extension protocol: the requests the diagnostics drawer
// sends and the responses the debug dispatch answers with. They live apart from the
// core protocol because the report type reaches into lib/contract, which only the
// extension protocol and the debug routes may pull in. The response types are imported
// with import type so they erase and never drag the debug canary into the production
// bundle.

import { z } from 'zod';
import type { Result } from '../utils/result';
import type { LatestRaw, RequestLogEntry, SimSettings } from '../api/types';
import type { DataQualityReport } from '../contract/report';

export const debugRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('debug/getRequestLog') }),
  z.object({ type: z.literal('debug/getReport') }),
  z.object({ type: z.literal('debug/getLatestRaw') }),
  z.object({ type: z.literal('debug/getSimulation') }),
  z.object({ type: z.literal('debug/clearCache') }),
  z.object({
    type: z.literal('debug/setFixture'),
    fixtureId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('debug/setFault'),
    faultId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('debug/setMutation'),
    mutationId: z.string().nullable(),
  }),
]);

/** The response payload each debug request resolves to, keyed by discriminant. */
export interface DebugResponseMap {
  'debug/getRequestLog': Result<RequestLogEntry[]>;
  'debug/getReport': Result<DataQualityReport | null>;
  'debug/getLatestRaw': Result<LatestRaw | null>;
  'debug/getSimulation': Result<SimSettings>;
  'debug/clearCache': Result<void>;
  'debug/setFixture': Result<void>;
  'debug/setFault': Result<void>;
  'debug/setMutation': Result<void>;
}
