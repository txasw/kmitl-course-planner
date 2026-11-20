// Records one moment of the onboarding record from this document, such as the first
// panel open or the entry toast opt out. The store takes the timestamp before the write
// starts, so a second caller in this document sees it already recorded and does not
// write again. The repository keeps the first timestamp any tab wrote, and the merged
// record it resolves replaces the optimistic one. A failed write leaves the optimistic
// record in place for this document.
//
// The coach mark snooze day (ADR-0072) goes through the same optimistic write, but it is
// not a moment kept once: the latest choice replaces the stored day, so it is always
// written. The product tour mark (ADR-0074) is the same kind of write: a replay that ends
// replaces the mark the first run left.

import { TOUR_VERSION } from '@/lib/onboarding/tour';
import type {
  OnboardingField,
  OnboardingPatch,
  OnboardingRecord,
  OnboardingRepository,
  TourMark,
} from '@/lib/storage/onboarding';
import { onboardingStore } from './onboardingStore';

type RecordWriter = Pick<OnboardingRepository, 'patch'>;

/** Shows the patched record in this document at once, then stores it. */
function writeThrough(
  record: RecordWriter,
  optimistic: OnboardingRecord,
  patch: OnboardingPatch,
): void {
  onboardingStore.getState().setRecord(optimistic);
  void record.patch(patch).then(
    (merged) => {
      onboardingStore.getState().setRecord(merged);
    },
    () => undefined,
  );
}

export function recordOnboardingMoment(
  record: RecordWriter,
  field: OnboardingField,
): void {
  const current = onboardingStore.getState().record;
  if (current[field] !== undefined) return;
  const at = new Date().toISOString();
  writeThrough(record, { ...current, [field]: at }, { [field]: at });
}

/** Records that the coach mark stays away for the given local day. */
export function recordCoachMarkSnooze(record: RecordWriter, day: string): void {
  const current = onboardingStore.getState().record;
  writeThrough(
    record,
    { ...current, coachMarkSnoozedOn: day },
    { coachMarkSnoozedOn: day },
  );
}

/** Records how the current tour ended, which keeps it from starting on its own again. */
export function recordTourOutcome(
  record: RecordWriter,
  outcome: TourMark['outcome'],
): void {
  const current = onboardingStore.getState().record;
  const tourSeen: TourMark = {
    version: TOUR_VERSION,
    outcome,
    at: new Date().toISOString(),
  };
  writeThrough(record, { ...current, tourSeen }, { tourSeen });
}
