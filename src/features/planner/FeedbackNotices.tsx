// The notices the feedback strip shows, one at a time: a blocked reason with up to two
// fitting alternatives or a reveal action, a cross term switch, and a drag hint. Each
// ends with the same dismiss control. Their actions carry data-feedback-action, so a
// blocked or cross term add can move focus to the first of them; the dismiss control
// does not, since the way forward comes before the way out.

import { X } from 'lucide-react';
import type { Section } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { alternativeSections } from '@/lib/planner/suggestions';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { revealCourse } from '@/features/catalog/revealCourse';
import { courseToggle } from '@/features/catalog/courseFocus';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import {
  dragStore,
  type BlockedFeedback,
  type CrossTermFeedback,
} from './dragStore';
import { conflictReasonText } from './conflictText';

/**
 * The first action of the notice the strip shows: the first alternative chip of a
 * blocked notice, or its reveal action when none fits, or the switch of a cross term
 * notice. A blocked or cross term add moves focus here, so a keyboard user can take the
 * way forward without hunting for it.
 */
export function firstFeedbackAction(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-feedback-action]');
}

/**
 * The close control every visible notice ends with, so a student can clear one without
 * waiting out its window or taking one of its actions. It is not a strip action: a
 * blocked add moves focus to the way forward, never to the way out.
 */
function DismissButton({ t }: { t: Translate }) {
  return (
    <button
      type="button"
      aria-label={t('feedback.dismiss')}
      onClick={() => {
        dragStore.getState().dismissNotice();
      }}
      className={`ml-auto inline-flex shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <X size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function BlockedNotice({
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
                // toggle of the course, which collapses with the add, or the switch of
                // the cross term notice that replaces this one.
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
                  (outcome) => {
                    if (root === null) return [];
                    return outcome.ok
                      ? [courseToggle(root, alternative.subjectId)]
                      : [firstFeedbackAction(root)];
                  },
                );
              }}
              className={`rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
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
          className={`text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
        >
          {t('feedback.revealInCatalog')}
        </button>
      )}
      <DismissButton t={t} />
    </div>
  );
}

export function CrossTermNotice({
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
        data-feedback-action
        onClick={() => {
          switchOrCreatePlanForTerm(feedback.browsedTerm);
          dragStore.getState().clearCrossTerm();
        }}
        className={`text-primary-strong underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
      >
        {t('term.switch')}
      </button>
      <DismissButton t={t} />
    </div>
  );
}

/** A drag hint, boxed when the strip floats so it reads on the surface under it. */
export function HintNotice({
  hint,
  boxed,
  t,
}: {
  hint: string;
  boxed: boolean;
  t: Translate;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs text-ink-soft ${
        boxed ? 'rounded-kcp border border-border bg-surface px-2 py-1' : ''
      }`}
    >
      <p>{hint}</p>
      <DismissButton t={t} />
    </div>
  );
}
