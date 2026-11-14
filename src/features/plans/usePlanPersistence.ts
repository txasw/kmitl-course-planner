// Binds the plan store to storage. On mount it hydrates the saved plans, then
// autosaves the whole plan list on any change with a short debounce, and flushes a
// pending save on unmount so a last moment change is not lost. A quarantined or refused
// load is surfaced through the storage issue store for the card to render. The
// subscription attaches only after hydration, so a hydrated value is not written
// straight back. Every settled read, hydrated, refused, or failed, marks the plan store
// loaded.
//
// The autosave state goes to the autosave store for the header indicator: saving from
// the first change until the latest save settles, then saved or failed. A failed save
// raises one error toast with a retry, which is its announcement, since the indicator is
// no live region. Later failures stay quiet until a save succeeds or the student retries,
// so a run of failing autosaves never repeats the toast. A successful save raises nothing.

import { useEffect } from 'react';
import { CURRENT_SCHEMA_VERSION } from '@/lib/storage/keys';
import type { PlanRepository, StorageAdapter } from '@/lib/storage/repo';
import { createTranslator } from '@/lib/i18n/t';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { autosaveStore, SAVE_INDICATOR_ID } from './autosaveStore';
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
    // The latest save started, so an older save that settles late does not overwrite
    // the state of a newer one.
    let latest = 0;
    let announceFailure = true;

    const showFailure = (): void => {
      const t = createTranslator(uiStore.getState().language);
      toastStore.getState().show('error', t('save.failedToast'), {
        label: t('action.retry'),
        run: (control) => {
          commitAndFocus(control, SAVE_INDICATOR_ID, retry);
        },
      });
    };

    const settle = (run: number, saved: boolean): void => {
      // A newer save, started or still debounced, owns the state from here.
      if (isCancelled() || run !== latest || timer !== undefined) return;
      if (saved) {
        announceFailure = true;
        autosaveStore.getState().setStatus('saved');
        return;
      }
      autosaveStore.getState().setStatus('failed');
      if (announceFailure) {
        announceFailure = false;
        showFailure();
      }
    };

    const save = (): void => {
      latest += 1;
      const run = latest;
      void repo
        .save({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          plans: planStore.getState().plans,
        })
        .then(
          (result) => {
            settle(run, result.ok);
          },
          () => {
            settle(run, false);
          },
        );
    };

    // A retry the student asks for is announced again when it fails, so pressing it
    // never meets silence.
    const retry = (): void => {
      if (isCancelled()) return;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      announceFailure = true;
      autosaveStore.getState().setStatus('saving');
      save();
    };

    const subscribe = (): void => {
      if (isCancelled() || unsubscribe !== undefined) return;
      autosaveStore.getState().attach(retry);
      unsubscribe = planStore.subscribe((state, previous) => {
        if (state.plans !== previous.plans) {
          if (timer !== undefined) clearTimeout(timer);
          autosaveStore.getState().setStatus('saving');
          timer = setTimeout(() => {
            timer = undefined;
            save();
          }, AUTOSAVE_DEBOUNCE_MS);
        }
      });
    };

    void repo.load().then(
      (outcome) => {
        if (isCancelled()) return;
        if (outcome.status === 'refused') {
          // A newer schema is left untouched: do not hydrate and do not autosave, so a
          // later edit cannot overwrite the newer data the refusal exists to preserve.
          storageIssueStore
            .getState()
            .setIssue({ kind: 'refused', reason: outcome.reason });
          planStore.getState().markLoaded();
          return;
        }
        planStore.getState().hydrate(outcome.root.plans);
        // Attach the autosave before the quarantine blob read, so a failed read cannot
        // leave persistence silently disabled.
        subscribe();
        if (outcome.status === 'quarantined') {
          void adapter.get(outcome.quarantineKey).then(
            (blob) => {
              if (isCancelled()) return;
              storageIssueStore.getState().setIssue({
                kind: 'quarantined',
                data: JSON.stringify(blob, null, 2),
              });
            },
            () => {
              if (isCancelled()) return;
              // The data is set aside on disk; the card just cannot offer its export.
              storageIssueStore
                .getState()
                .setIssue({ kind: 'quarantined', data: '' });
            },
          );
        }
      },
      () => {
        // The read failed, likely a transient storage error. Enable best effort saving
        // for this session rather than silently dropping every later edit.
        if (isCancelled()) return;
        planStore.getState().markLoaded();
        subscribe();
      },
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timer !== undefined) {
        clearTimeout(timer);
        save();
      }
      autosaveStore.getState().detach();
    };
  }, [repo, adapter]);
}
