// Content owned UI preferences, persisted separately from the plan root so the
// plan store binding can stay deferred and the plan-store-only persistence rule
// from ADR-0005 holds. Reads validate through Zod like every storage read; an
// invalid or absent blob resolves to null so the caller falls back to defaults
// rather than crashing.

import { z } from 'zod';
import type { StorageAdapter } from './repo';
import { PREFS_KEY } from './keys';
import { displayOptionsSchema } from '../planner/displayOptions';
import { curriculumProfileSchema } from '../catalog/curriculumProfile';
import { SUGGEST_OBJECTIVES } from '../planner/suggestRank';
import { SUGGEST_PREFERENCES } from '../planner/suggestScore';
import { TIMETABLE_VIEWS } from '../planner/dayView';

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
  // The export template slug is a plain string so an unknown value from a newer
  // build still validates; the planner resolves it and falls back to the default.
  exportTemplate: z.string().optional(),
  // The curriculum the open to my curriculum filter matches. A stored profile that
  // no longer validates is dropped alone, so it never costs the language or the
  // other preferences; the filter then asks for the curriculum again.
  curriculumProfile: curriculumProfileSchema.optional().catch(undefined),
  // The last suggestion objective and preference. A value this build does not know,
  // from a newer build, reads as absent rather than failing the whole blob, so the
  // language and the other preferences survive and the dialog opens on its default.
  suggestObjective: z.enum(SUGGEST_OBJECTIVES).optional().catch(undefined),
  suggestPreference: z.enum(SUGGEST_PREFERENCES).optional().catch(undefined),
  // The layout a narrow timetable shows, the day or the week (ADR-0049). An unknown
  // value reads as absent like the suggestion options, so the view opens on the day.
  timetableView: z.enum(TIMETABLE_VIEWS).optional().catch(undefined),
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
