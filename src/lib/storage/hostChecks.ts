// The worker's record of the host app scripts it read for the host check (ADR-0079), in
// storage.local under one key. Each entry is keyed by the script's public name, which
// names its content, so what was read for a name holds for that name: the part
// fingerprints, or that the script could not be read. A request that did not complete is
// kept with its time, so a later visit retries only after a wait and the host is never
// polled. Entries of another fingerprint version are ignored, since their hashes mean
// something else. The record is a cache: a blob that fails its schema is dropped and the
// next check reads the script again. It holds no student data.

import { z } from 'zod';
import { FINGERPRINT_VERSION } from '../regis/fingerprint/fingerprint';
import { PART_IDS } from '../regis/fingerprint/partIds';
import { APP_SCRIPT_NAME } from '../regis/hostContract';
import { createSerialQueue } from '../utils/serialQueue';
import { HOST_CHECK_KEY } from './keys';
import type { StorageAdapter } from './repo';

/** How many app scripts the record keeps; the oldest beyond it drop on save. */
export const HOST_CHECK_LIMIT = 8;

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

const resultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('read'),
    parts: z.partialRecord(z.enum(PART_IDS), hashSchema),
  }),
  z.object({ kind: z.literal('unreadable') }),
  z.object({ kind: z.literal('failed'), at: z.number().int().nonnegative() }),
]);

const entrySchema = z.object({
  app: z.string().regex(APP_SCRIPT_NAME),
  version: z.number().int(),
  result: resultSchema,
});

const rootSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(entrySchema).max(HOST_CHECK_LIMIT),
});

export type HostCheckResult = z.infer<typeof resultSchema>;
type HostCheckEntry = z.infer<typeof entrySchema>;

export interface HostCheckRepository {
  /** What was read for an app script at this fingerprint version, or null. */
  load(app: string): Promise<HostCheckResult | null>;
  save(app: string, result: HostCheckResult): Promise<void>;
}

export function createHostCheckRepository(
  adapter: StorageAdapter,
): HostCheckRepository {
  const enqueue = createSerialQueue();

  async function entries(): Promise<HostCheckEntry[]> {
    const parsed = rootSchema.safeParse(await adapter.get(HOST_CHECK_KEY));
    return parsed.success ? parsed.data.entries : [];
  }

  return {
    load: async (app) => {
      const entry = (await entries()).find(
        (item) => item.app === app && item.version === FINGERPRINT_VERSION,
      );
      return entry?.result ?? null;
    },
    save: (app, result) =>
      enqueue(async () => {
        const kept = (await entries()).filter((item) => item.app !== app);
        const next = [
          { app, version: FINGERPRINT_VERSION, result },
          ...kept,
        ].slice(0, HOST_CHECK_LIMIT);
        await adapter.set(HOST_CHECK_KEY, { schemaVersion: 1, entries: next });
      }),
  };
}
