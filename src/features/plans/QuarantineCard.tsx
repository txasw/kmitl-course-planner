// A card shown when plan storage had a problem on load: a corrupt blob that was
// quarantined and set aside, or a stored schema newer than this build knows. For a
// quarantine it offers to copy the set aside data so the user can keep it. It renders
// inside the overlay so the message reaches the user when they open the planner.

import { useStore } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/t';
import { useTranslation } from '@/features/shell/useTranslation';
import { copyText } from '@/features/shell/copyText';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { storageIssueStore, type StorageIssue } from './storageIssueStore';

function messageKey(issue: StorageIssue): TranslationKey {
  switch (issue.kind) {
    case 'quarantined':
      return 'storage.quarantined';
    case 'refused':
      return 'storage.refused';
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
            void copyText(
              issue.data,
              t('storage.exported'),
              t('storage.exportFailed'),
            );
          }}
          className={`inline-flex items-center justify-center rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          {t('storage.export')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          storageIssueStore.getState().setIssue(null);
        }}
        className={`inline-flex items-center justify-center rounded-kcp px-1 text-ink-soft underline hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        {t('action.close')}
      </button>
    </div>
  );
}
