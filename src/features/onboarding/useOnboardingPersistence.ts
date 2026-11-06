// Binds the onboarding store to storage. On mount it reads the worker owned install
// record and the content owned onboarding record together and marks the store
// loaded once both reads settle, a failed read counting as absent so a storage
// fault never leaves the first run surfaces waiting. It then records the moment the
// panel first opens. The install record is only read here: the worker owns that
// key, and content writes nothing but the onboarding record, through its
// repository.

import { useEffect } from 'react';
import type { InstallRepository } from '@/lib/storage/install';
import {
  emptyOnboardingRecord,
  type OnboardingRepository,
} from '@/lib/storage/onboarding';
import { uiStore } from '@/features/shell/uiStore';
import { onboardingStore } from './onboardingStore';
import { recordOnboardingMoment } from './recordOnboardingMoment';

export interface OnboardingPersistenceDeps {
  /** Only the read: the worker owns the install key, so content cannot write it. */
  install: Pick<InstallRepository, 'load'>;
  record: OnboardingRepository;
}

export function useOnboardingPersistence({
  install,
  record,
}: OnboardingPersistenceDeps): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void Promise.allSettled([install.load(), record.load()]).then(
      ([installRead, recordRead]) => {
        if (cancelled) return;
        const store = onboardingStore.getState();
        store.hydrate(
          installRead.status === 'fulfilled' ? installRead.value : null,
          recordRead.status === 'fulfilled'
            ? recordRead.value
            : emptyOnboardingRecord(),
        );
        // Watching starts after the read, so the stored record decides whether the
        // first open is already recorded; a panel opened during the read counts.
        if (uiStore.getState().isOpen) {
          recordOnboardingMoment(record, 'panelFirstOpenedAt');
        }
        unsubscribe = uiStore.subscribe((state, previous) => {
          if (state.isOpen && !previous.isOpen) {
            recordOnboardingMoment(record, 'panelFirstOpenedAt');
          }
        });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [install, record]);
}
