// The replace actions of a blocked notice (ADR-0068): one per subject that blocks the
// add by time and that the blocked section could take the place of, so a keyboard or
// touch user reaches the swap a drag commits on a swap target. Each one removes the
// blocker with its pair and adds the blocked section with its pair as one undoable
// step. Only a replacement that would succeed is offered, so none answers with the same
// refusal.

import { useStore } from 'zustand';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import {
  replaceOptions,
  type ReplaceOption,
} from '@/lib/planner/sectionChange';
import { TARGET_SIZE } from '@/lib/ui/target';
import { swapSectionInPlan } from '@/features/plans/addToPlan';
import { planStore } from '@/features/plans/planStore';
import { courseToggle } from '@/features/catalog/courseFocus';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { dragStore, type BlockedFeedback } from './dragStore';
import { firstFeedbackAction } from './feedbackAction';

const REPLACE_ACTION = `rounded-kcp border border-danger bg-surface px-2 py-1 text-danger outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`;

/** Commit a replacement and route its outcome: clear the notice when it lands, or say
 * why it did not through the notice that takes this one's place. */
function replace(blocked: BlockedFeedback, option: ReplaceOption) {
  const outcome = swapSectionInPlan(
    option.removeIds,
    blocked.course,
    blocked.section,
  );
  const drag = dragStore.getState();
  if (outcome.ok) {
    drag.clearBlocked();
  } else if ('crossTerm' in outcome) {
    drag.showCrossTerm(outcome.crossTerm);
  } else if (outcome.conflicts.length > 0) {
    drag.showBlocked({ ...blocked, conflicts: outcome.conflicts });
  } else {
    drag.clearBlocked();
  }
  return outcome;
}

export function ReplaceActions({
  blocked,
  t,
}: {
  blocked: BlockedFeedback;
  t: Translate;
}) {
  const entries = useStore(planStore, (state) => state.entries);
  const options = replaceOptions(
    entries,
    blocked.course,
    blocked.section,
    blocked.conflicts,
  );
  return options.map((option) => (
    <button
      key={option.subjectId}
      type="button"
      data-feedback-action
      onClick={(event) => {
        // A replacement is an add, so focus lands where a row add does: the card toggle
        // of the course that joined, or the first action of the notice that follows.
        const root = rootOf(event.currentTarget);
        commitThenFocus(
          () => replace(blocked, option),
          (outcome) => {
            if (root === null) return [];
            return outcome.ok
              ? [courseToggle(root, blocked.section.subjectId)]
              : [firstFeedbackAction(root)];
          },
        );
      }}
      className={REPLACE_ACTION}
    >
      {fillTemplate(t('feedback.replace'), {
        subject: option.subjectId,
        section: `${t('section.code')} ${option.sections.join(' ')}`,
      })}
    </button>
  ));
}
