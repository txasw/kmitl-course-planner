// The placement feedback strip: a slim aria-live region under the grid header. A
// rejected drop shows the blocking reason and up to two alternative sections of
// the same subject that would fit, or a reveal action when none do; a removal
// shows a single undo. Both clear on their own window, six seconds for the blocked
// reason and ten for the undo. It is not the toast, which stays reserved for
// actions whose outcome is not otherwise visible on screen.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { Section } from '@/lib/domain/types';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Locale, Translate } from '@/lib/i18n/t';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { alternativeSections } from '@/lib/planner/suggestions';
import { planStore, usePlacedSections } from '@/features/plans/planStore';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { catalogStore } from '@/features/catalog/catalogStore';
import { dragStore, type BlockedFeedback } from './dragStore';
import { conflictReasonText } from './conflictText';

const UNDO_WINDOW_MS = 10_000;
const BLOCKED_WINDOW_MS = 6_000;
const ANNOUNCE_WINDOW_MS = 4_000;

interface FeedbackStripProps {
  locale: Locale;
  t: Translate;
}

function BlockedNotice({
  blocked,
  placed,
  t,
}: {
  blocked: BlockedFeedback;
  placed: Section[];
  t: Translate;
}) {
  const description = describeConflicts(blocked.conflicts);
  const alternatives = alternativeSections(
    blocked.course,
    placed,
    blocked.section,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-kcp border border-danger bg-danger-soft px-2 py-1 text-xs text-danger">
      <span>
        {description === null ? '' : conflictReasonText(description, t)}
      </span>
      {alternatives.length > 0 ? (
        <>
          <span className="text-ink-soft">{t('feedback.tryInstead')}</span>
          {alternatives.map((alternative) => (
            <button
              key={alternative.teachTableId}
              type="button"
              onClick={() => {
                addSectionToPlan(blocked.course, alternative);
                dragStore.getState().clearBlocked();
              }}
              className="rounded-kcp border border-border bg-surface px-2 py-0.5 font-medium text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('section.code')} {alternative.section}
              {alternative.meetings.length === 0
                ? ` (${t('footer.unscheduled')})`
                : ''}
            </button>
          ))}
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            catalogStore.getState().setText(blocked.section.subjectId);
            dragStore.getState().clearBlocked();
          }}
          className="font-medium text-primary underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('feedback.revealInCatalog')}
        </button>
      )}
    </div>
  );
}

function RemovedNotice({
  removed,
  locale,
  t,
}: {
  removed: PlanEntry;
  locale: Locale;
  t: Translate;
}) {
  const name =
    locale === 'th'
      ? removed.snapshot.subjectMeta.nameTh
      : removed.snapshot.subjectMeta.nameEn;
  return (
    <div className="flex items-center gap-2 rounded-kcp border border-border bg-surface-alt px-2 py-1 text-xs text-ink-soft">
      <span>
        {t('feedback.removed')} {removed.subjectId} {name}
      </span>
      <button
        type="button"
        onClick={() => {
          planStore.getState().undo();
        }}
        className="font-medium text-primary underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t('action.undo')}
      </button>
    </div>
  );
}

export function FeedbackStrip({ locale, t }: FeedbackStripProps) {
  const pendingUndo = useStore(planStore, (state) => state.pendingUndo);
  const blocked = useStore(dragStore, (state) => state.blocked);
  const announcement = useStore(dragStore, (state) => state.announcement);
  const hint = useStore(dragStore, (state) => state.hint);
  const placed = usePlacedSections();

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

  useEffect(() => {
    if (blocked === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dragStore.getState().clearBlocked();
    }, BLOCKED_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [blocked]);

  useEffect(() => {
    if (announcement === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dragStore.getState().clearAnnouncement();
    }, ANNOUNCE_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [announcement]);

  useEffect(() => {
    if (hint === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dragStore.getState().clearHint();
    }, BLOCKED_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [hint]);

  const removed = pendingUndo?.removed[0];

  return (
    <div aria-live="polite" className="min-h-[1.75rem] shrink-0">
      {blocked !== null ? (
        <BlockedNotice blocked={blocked} placed={placed} t={t} />
      ) : removed !== undefined ? (
        <RemovedNotice removed={removed} locale={locale} t={t} />
      ) : hint !== null ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : announcement !== null ? (
        <span className="sr-only">{announcement}</span>
      ) : null}
    </div>
  );
}
