// The placement feedback strip: a slim aria-live region under the grid header. A
// rejected drop shows the blocking reason and up to two alternative sections of the
// same subject that would fit, or a reveal action when none do. A cross term add and a
// drag hint show here too. Each clears on its own window, six seconds for the blocked
// reason. A catalog add is confirmed by a screen reader only line here only while the
// timetable is in view; while the sheet covers it, the add toast speaks instead and this
// line stays empty, so the add is read once. It is not the toast, which stays reserved
// for actions whose outcome is not otherwise visible on screen; the undo for a removal,
// move, or swap is an undo toast in the bottom region, where the eye already is on the
// block that changed. A notice that clears while one of its actions holds focus hands
// focus back to the control it came from, so the timer that clears it never drops focus
// to the document body.

import { useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react';
import { useStore } from 'zustand';
import type { Section } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { alternativeSections } from '@/lib/planner/suggestions';
import { usePlacedSections } from '@/features/plans/planStore';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { revealCourse } from '@/features/catalog/revealCourse';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { commitThenFocus, focusFirst } from '@/features/shell/restoreFocus';
import { focusIsLost, rootOf } from '@/features/shell/useFocusTrap';
import { courseToggle } from '@/features/catalog/courseFocus';
import {
  dragStore,
  type BlockedFeedback,
  type CrossTermFeedback,
} from './dragStore';
import { conflictReasonText } from './conflictText';

/**
 * The first action of the blocked notice: the first alternative chip, or the reveal
 * action when none fits. A blocked add moves focus here, so a keyboard user can take
 * the alternative without hunting for it.
 */
export function firstFeedbackAction(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-feedback-action]');
}

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
  const tier = useLayoutTier();
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
              data-feedback-action
              onClick={(event) => {
                // A chip is an add, so it lands focus where a row add does: the card
                // toggle of the course, which collapses with the add.
                const root = rootOf(event.currentTarget);
                commitThenFocus(
                  () => {
                    const outcome = addSectionToPlan(
                      blocked.course,
                      alternative,
                    );
                    if (!outcome.ok && 'crossTerm' in outcome) {
                      dragStore.getState().showCrossTerm(outcome.crossTerm);
                    } else {
                      dragStore.getState().clearBlocked();
                    }
                    return outcome;
                  },
                  (outcome) =>
                    outcome.ok && root !== null
                      ? [courseToggle(root, alternative.subjectId)]
                      : [],
                );
              }}
              className="rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          data-feedback-action
          onClick={() => {
            revealCourse(blocked.section.subjectId, tier);
            dragStore.getState().clearBlocked();
          }}
          className="text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
        className="text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
  const stripRef = useRef<HTMLDivElement>(null);
  // The control focus came from when it entered the strip, such as the add button whose
  // blocked add moved focus to the first alternative. It is forgotten once focus moves on
  // to a control outside the strip, which then owns it.
  const originRef = useRef<HTMLElement | null>(null);
  const handleFocusIn = (event: FocusEvent<HTMLDivElement>) => {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
      originRef.current = from;
    }
  };
  const handleFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget;
    if (to instanceof Node && !event.currentTarget.contains(to)) {
      originRef.current = null;
    }
  };
  // Runs in the commit that swapped the notice, before the focus trap checks for dropped
  // focus, so focus returns straight to its origin rather than to the panel. An origin
  // that the same change removed, such as an add button whose course was just added, is
  // skipped, and the action that removed it moves focus itself.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const origin = originRef.current;
    if (strip === null || origin === null || !focusIsLost(strip)) return;
    originRef.current = null;
    focusFirst([origin]);
  }, [blocked, crossTerm, hint, announcement]);

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
    <div
      ref={stripRef}
      aria-live="polite"
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      className="min-h-[1.75rem] shrink-0"
    >
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
