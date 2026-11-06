// Records one moment of the onboarding record from this document, such as the first
// panel open or the entry toast opt out. The store takes the timestamp before the write
// starts, so a second caller in this document sees it already recorded and does not
// write again. The repository keeps the first timestamp any tab wrote, and the merged
// record it resolves replaces the optimistic one. A failed write leaves the optimistic
// record in place for this document.

import type {
  OnboardingField,
  OnboardingRepository,
} from '@/lib/storage/onboarding';
import { onboardingStore } from './onboardingStore';

export function recordOnboardingMoment(
  record: Pick<OnboardingRepository, 'patch'>,
  field: OnboardingField,
): void {
  const store = onboardingStore.getState();
  if (store.record[field] !== undefined) return;
  const at = new Date().toISOString();
  store.setRecord({ ...store.record, [field]: at });
  void record.patch({ [field]: at }).then(
    (merged) => {
      onboardingStore.getState().setRecord(merged);
    },
    () => undefined,
  );
}
