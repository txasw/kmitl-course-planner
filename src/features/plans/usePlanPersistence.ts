// Binds the plan store to storage. On mount it hydrates the saved plans, then
// autosaves the whole plan list on any change with a short debounce, and flushes a
// pending save on unmount so a last moment change is not lost. A quarantined, refused,
// or save refused outcome is surfaced through the storage issue store for the card to
// render. The subscription attaches only after hydration, so a hydrated value is not
// written straight back.

import { useEffect } from 'react';
import { CURRENT_SCHEMA_VERSION } from '@/lib/storage/keys';
import type { PlanRepository, StorageAdapter } from '@/lib/storage/repo';
import { planStore } from './planStore';
import { storageIssueStore } from './storageIssueStore';

const AUTOSAVE_DEBOUNCE_MS = 300;

export interface PlanPersistenceDeps {
  repo: PlanRepository;
  adapter: StorageAdapter;
}

export function usePlanPersistence({
  repo,
  adapter,
}: PlanPersistenceDeps): void {
  useEffect(() => {
    let cancelled = false;
    // Read through a function so the flag is not narrowed to a literal after the
    // first guard, which would flag the later guards as always false.
    const isCancelled = () => cancelled;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = (): void => {
      void repo
        .save({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          plans: planStore.getState().plans,
        })
        .then((result) => {
          if (!result.ok) {
            storageIssueStore.getState().setIssue({ kind: 'saveRefused' });
          }
        });
    };

    void repo.load().then(async (outcome) => {
      if (isCancelled()) return;
      if (outcome.status === 'refused') {
        // A newer schema is left untouched rather than loaded, to avoid corrupting it.
        storageIssueStore
          .getState()
          .setIssue({ kind: 'refused', reason: outcome.reason });
      } else {
        planStore.getState().hydrate(outcome.root.plans);
        if (outcome.status === 'quarantined') {
          const blob = await adapter.get(outcome.quarantineKey);
          if (isCancelled()) return;
          storageIssueStore.getState().setIssue({
            kind: 'quarantined',
            data: JSON.stringify(blob, null, 2),
          });
        }
      }
      if (isCancelled()) return;
      unsubscribe = planStore.subscribe((state, previous) => {
        if (state.plans !== previous.plans) {
          if (timer !== undefined) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = undefined;
            save();
          }, AUTOSAVE_DEBOUNCE_MS);
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timer !== undefined) {
        clearTimeout(timer);
        save();
      }
    };
  }, [repo, adapter]);
}
