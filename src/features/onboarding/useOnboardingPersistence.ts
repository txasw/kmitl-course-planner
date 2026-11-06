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

export interface OnboardingPersistenceDeps {
  /** Only the read: the worker owns the install key, so content cannot write it. */
  install: Pick<InstallRepository, 'load'>;
  record: OnboardingRepository;
}

// The store takes the timestamp before the write starts, so a second mounted app in
// this document sees it already recorded and does not write again. The repository
// keeps the first timestamp any tab wrote, and the merged record it resolves
// replaces the optimistic one.
function recordFirstPanelOpen(record: OnboardingRepository): void {
  const store = onboardingStore.getState();
  if (store.record.panelFirstOpenedAt !== undefined) return;
  const panelFirstOpenedAt = new Date().toISOString();
  store.setRecord({ ...store.record, panelFirstOpenedAt });
  void record.patch({ panelFirstOpenedAt }).then(
    (merged) => {
      onboardingStore.getState().setRecord(merged);
    },
    () => undefined,
  );
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
        // Nothing performs the mount handshake or the welcome claim yet, so both
        // settle as soon as the records are read and no surface waits on them.
        store.settleHandshake();
        store.settleWelcome();

        // Watching starts after the read, so the stored record decides whether the
        // first open is already recorded; a panel opened during the read counts.
        if (uiStore.getState().isOpen) recordFirstPanelOpen(record);
        unsubscribe = uiStore.subscribe((state, previous) => {
          if (state.isOpen && !previous.isOpen) recordFirstPanelOpen(record);
        });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [install, record]);
}
