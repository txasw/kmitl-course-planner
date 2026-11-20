// The content owned onboarding record: when the welcome showed, when the panel first
// opened, when the student turned the entry toast off, and the local day the student
// last asked the selector coach mark to stay away (ADR-0072). Each moment is recorded
// once and kept, so a later write never moves it. The day is the exception: it is a
// snooze rather than a moment, so the latest write replaces it. Reads validate
// through Zod; each field is caught on its own, so one bad value drops alone instead
// of costing the others, and an absent or unreadable blob loads as an empty record.
// The day is optional, so a record written before it existed still reads as version 1
// and needs no migration. The product tour mark (ADR-0074) follows the same rules: an
// optional object caught as a whole, naming the tour version the student finished or
// skipped, which the latest write replaces, so a record from before it still reads as
// version 1 and simply finds the tour due.

import { z } from 'zod';
import { createSerialQueue } from '../utils/serialQueue';
import type { StorageAdapter } from './repo';
import { ONBOARDING_KEY } from './keys';

export const ONBOARDING_FIELDS = [
  'welcomeShownAt',
  'panelFirstOpenedAt',
  'entryToastOptOutAt',
] as const;
export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];

const timestampSchema = z.iso.datetime().optional().catch(undefined);

/** A local calendar day as YYYY-MM-DD, which sorts in calendar order as a string. */
const dayStampSchema = z.iso.date().optional().catch(undefined);

/** How the product tour ended: walked to its last step, or skipped on the way. */
export const TOUR_OUTCOMES = ['completed', 'skipped'] as const;

/** The tour version the student finished or skipped, how, and when. */
export const tourMarkSchema = z.object({
  version: z.number().int().positive(),
  outcome: z.enum(TOUR_OUTCOMES),
  at: z.iso.datetime(),
});
export type TourMark = z.infer<typeof tourMarkSchema>;

export const onboardingRecordSchema = z.object({
  schemaVersion: z.literal(1),
  welcomeShownAt: timestampSchema,
  panelFirstOpenedAt: timestampSchema,
  entryToastOptOutAt: timestampSchema,
  coachMarkSnoozedOn: dayStampSchema,
  tourSeen: tourMarkSchema.optional().catch(undefined),
});
export type OnboardingRecord = z.infer<typeof onboardingRecordSchema>;

/**
 * The timestamps to record, where a field already set keeps its first value, and the
 * coach mark snooze day and the tour mark, which replace the stored ones.
 */
export type OnboardingPatch = Partial<Record<OnboardingField, string>> & {
  coachMarkSnoozedOn?: string;
  tourSeen?: TourMark;
};

function sameTourMark(a: TourMark | undefined, b: TourMark | undefined) {
  return (
    a?.version === b?.version && a?.outcome === b?.outcome && a?.at === b?.at
  );
}

export interface OnboardingRepository {
  load(): Promise<OnboardingRecord>;
  /** Records the given timestamps over a fresh read and resolves the merged record. */
  patch(fields: OnboardingPatch): Promise<OnboardingRecord>;
}

export function emptyOnboardingRecord(): OnboardingRecord {
  return { schemaVersion: 1 };
}

export function createOnboardingRepository(
  adapter: StorageAdapter,
): OnboardingRepository {
  // Patches from this document run one at a time, so each one reads the record the
  // previous one wrote.
  const enqueue = createSerialQueue();

  async function load(): Promise<OnboardingRecord> {
    const parsed = onboardingRecordSchema.safeParse(
      await adapter.get(ONBOARDING_KEY),
    );
    return parsed.success ? parsed.data : emptyOnboardingRecord();
  }

  // Reading again right before the merge means another tab's field written since
  // this document loaded is carried forward rather than erased.
  async function merge(fields: OnboardingPatch): Promise<OnboardingRecord> {
    const current = await load();
    const merged = emptyOnboardingRecord();
    let changed = false;
    for (const field of ONBOARDING_FIELDS) {
      const kept = current[field];
      const incoming = fields[field];
      if (kept !== undefined) merged[field] = kept;
      else if (incoming !== undefined) {
        merged[field] = incoming;
        changed = true;
      }
    }
    // Every writer stamps its own today, so the latest write is the student's latest
    // choice. Keeping the later of the two instead would let a day written under a
    // clock set far ahead outlive every correct day after it.
    const day = fields.coachMarkSnoozedOn ?? current.coachMarkSnoozedOn;
    if (day !== undefined) merged.coachMarkSnoozedOn = day;
    if (day !== current.coachMarkSnoozedOn) changed = true;
    // A replay of the tour ends in a newer mark, so the latest one stands, as for the day.
    const tour = fields.tourSeen ?? current.tourSeen;
    if (tour !== undefined) merged.tourSeen = tour;
    if (!sameTourMark(tour, current.tourSeen)) changed = true;
    if (changed) await adapter.set(ONBOARDING_KEY, merged);
    return merged;
  }

  return {
    load,
    patch: (fields) => enqueue(() => merge(fields)),
  };
}
