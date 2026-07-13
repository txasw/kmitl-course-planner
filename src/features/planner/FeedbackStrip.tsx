// The placement feedback strip: a slim aria-live region under the grid header. A
// rejected drop shows the blocking reason and up to two alternative sections of the
// same subject that would fit, or a reveal action when none do. A cross term add and a
// drag hint show here too. Each clears on its own window, six seconds for the blocked
// reason. It is not the toast, which stays reserved for actions whose outcome is not
// otherwise visible on screen; the undo for a removal, move, or swap is an undo toast in
// the bottom region, where the eye already is on the block that changed.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { Section } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { alternativeSections } from '@/lib/planner/suggestions';
import { usePlacedSections } from '@/features/plans/planStore';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { catalogStore } from '@/features/catalog/catalogStore';
import {
  dragStore,
  type BlockedFeedback,
  type CrossTermFeedback,
} from './dragStore';
import { conflictReasonText } from './conflictText';

const BLOCKED_WINDOW_MS = 6_000;
const ANNOUNCE_WINDOW_MS = 4_000;

interface FeedbackStripProps {
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
                const outcome = addSectionToPlan(blocked.course, alternative);
                if (!outcome.ok && 'crossTerm' in outcome) {
                  dragStore.getState().showCrossTerm({
                    planTerm: outcome.crossTerm.planTerm,
                    browsedTerm: outcome.crossTerm.incomingTerm,
                  });
                } else {
                  dragStore.getState().clearBlocked();
                }
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
          className="font-medium text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('feedback.revealInCatalog')}
        </button>
      )}
    </div>
  );
}

function CrossTermNotice({
  feedback,
  t,
}: {
  feedback: CrossTermFeedback;
  t: Translate;
}) {
  const planTerm = `${feedback.planTerm.semester}/${feedback.planTerm.year}`;
  const browsedTerm = `${feedback.browsedTerm.semester}/${feedback.browsedTerm.year}`;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-kcp border border-warn bg-primary-soft px-2 py-1 text-xs text-ink">
      <span>
        {t('term.planIs')} {planTerm}. {t('term.sectionIs')} {browsedTerm}
      </span>
      <button
        type="button"
        onClick={() => {
          switchOrCreatePlanForTerm(feedback.browsedTerm);
          dragStore.getState().clearCrossTerm();
        }}
        className="font-medium text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t('term.switch')}
      </button>
    </div>
  );
}

export function FeedbackStrip({ t }: FeedbackStripProps) {
  const blocked = useStore(dragStore, (state) => state.blocked);
  const crossTerm = useStore(dragStore, (state) => state.crossTerm);
  const announcement = useStore(dragStore, (state) => state.announcement);
  const hint = useStore(dragStore, (state) => state.hint);
  const placed = usePlacedSections();

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
    if (crossTerm === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dragStore.getState().clearCrossTerm();
    }, BLOCKED_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [crossTerm]);

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

  return (
    <div aria-live="polite" className="min-h-[1.75rem] shrink-0">
      {crossTerm !== null ? (
        <CrossTermNotice feedback={crossTerm} t={t} />
      ) : blocked !== null ? (
        <BlockedNotice blocked={blocked} placed={placed} t={t} />
      ) : hint !== null ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : announcement !== null ? (
        <span className="sr-only">{announcement}</span>
      ) : null}
    </div>
  );
}
