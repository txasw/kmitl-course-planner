// The placement feedback strip: a slim aria-live region under the grid header. It
// confirms a removal and offers a single undo for ten seconds, after which the
// undo window closes. It is not the toast, which is reserved for actions whose
// outcome is not otherwise visible on screen. The blocked drop reason and its
// alternative sections join this strip with the drag system.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { Locale, Translate } from '@/lib/i18n/t';
import { planStore } from '@/features/plans/planStore';

const UNDO_WINDOW_MS = 10_000;

interface FeedbackStripProps {
  locale: Locale;
  t: Translate;
}

export function FeedbackStrip({ locale, t }: FeedbackStripProps) {
  const pendingUndo = useStore(planStore, (state) => state.pendingUndo);

  useEffect(() => {
    if (pendingUndo === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      planStore.getState().clearUndo();
    }, UNDO_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pendingUndo]);

  const removed = pendingUndo?.[0];
  const name =
    removed === undefined
      ? ''
      : locale === 'th'
        ? removed.snapshot.subjectMeta.nameTh
        : removed.snapshot.subjectMeta.nameEn;

  return (
    <div aria-live="polite" className="min-h-[1.75rem] shrink-0">
      {removed !== undefined ? (
        <div className="flex items-center gap-2 rounded-kcp border border-border bg-surface-alt px-2 py-1 text-xs text-ink-soft">
          <span>
            {t('feedback.removed')} {removed.subjectId} {name}
          </span>
          <button
            type="button"
            onClick={() => {
              planStore.getState().undoRemove();
            }}
            className="font-medium text-primary underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('action.undo')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
