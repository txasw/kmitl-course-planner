// A card shown when plan storage had a problem on load or save: a corrupt blob that
// was quarantined and set aside, a stored schema newer than this build knows, or a
// refused save. For a quarantine it offers to copy the set aside data so the user can
// keep it. It renders inside the overlay so the message reaches the user when they
// open the planner.

import { useStore } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/t';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { storageIssueStore, type StorageIssue } from './storageIssueStore';

function messageKey(issue: StorageIssue): TranslationKey {
  switch (issue.kind) {
    case 'quarantined':
      return 'storage.quarantined';
    case 'refused':
      return 'storage.refused';
    case 'saveRefused':
      return 'storage.saveRefused';
  }
}

export function QuarantineCard() {
  const { t } = useTranslation();
  const issue = useStore(storageIssueStore, (state) => state.issue);
  if (issue === null) {
    return null;
  }
  return (
    <div
      role="alert"
      className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-kcp border border-danger bg-danger-soft px-3 py-2 text-xs"
    >
      <AlertTriangle
        size={14}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-danger"
      />
      <span className="text-ink">{t(messageKey(issue))}</span>
      {issue.kind === 'quarantined' ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(issue.data).then(
              () => {
                toastStore.getState().show('success', t('storage.exported'));
              },
              () => {
                toastStore.getState().show('error', t('storage.exportFailed'));
              },
            );
          }}
          className="rounded-kcp border border-border bg-surface px-2 py-0.5 font-medium text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('storage.export')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          storageIssueStore.getState().setIssue(null);
        }}
        className="font-medium text-ink-soft underline outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t('action.close')}
      </button>
    </div>
  );
}
