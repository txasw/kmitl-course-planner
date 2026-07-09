// Content owned UI preferences, persisted separately from the plan root so the
// plan store binding can stay deferred and the plan-store-only persistence rule
// from ADR-0005 holds. Reads validate through Zod like every storage read; an
// invalid or absent blob resolves to null so the caller falls back to defaults
// rather than crashing.

import { z } from 'zod';
import type { StorageAdapter } from './repo';
import { PREFS_KEY } from './keys';
import { displayOptionsSchema } from '../planner/displayOptions';

// language mirrors the i18n Locale union and viewMode mirrors the ui store's view
// mode; both are declared inline so the storage layer does not depend on the i18n
// or shell modules. viewMode and displayOptions are optional so a preferences blob
// written before they existed still validates and falls back to the defaults. The
// display options schema is owned by the planner, which is the layer that reads
// them; storage only persists the shape.
export const prefsSchema = z.object({
  schemaVersion: z.literal(1),
  language: z.enum(['th', 'en']),
  viewMode: z.enum(['edit', 'preview']).optional(),
  displayOptions: displayOptionsSchema.optional(),
});
export type Prefs = z.infer<typeof prefsSchema>;

export interface PrefsRepository {
  load(): Promise<Prefs | null>;
  save(prefs: Prefs): Promise<void>;
}

export function createPrefsRepository(
  adapter: StorageAdapter,
): PrefsRepository {
  return {
    async load() {
      const parsed = prefsSchema.safeParse(await adapter.get(PREFS_KEY));
      return parsed.success ? parsed.data : null;
    },
    async save(prefs) {
      await adapter.set(PREFS_KEY, prefs);
    },
  };
}
