// The add cell of a section comparison row, the table's one action. It offers what the
// section's catalog row would: an add button for an open section that places cleanly or
// clashes, the added mark once the section is in the plan, and the switch action for a
// section from another term. A conflicting add is not disabled, as on the card: pressing
// it routes through the normal add path, which rejects it, and the cell then states the
// reason in the same callout the card row uses, so the student sees why without leaving
// the table. A full, closed, or duplicate subject section cannot be added by any path, so
// the cell says so in words beside the status column that names the reason. The cell
// stays in view on the trailing edge as the table scrolls sideways, on the row's own
// surface.

import { useId } from 'react';
import { Check, Plus } from 'lucide-react';
import type { Section } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { ComparisonRow } from '@/lib/catalog/compareSections';
import { describeConflicts } from '@/lib/planner/describeConflict';
import type { AddOutcome } from '@/lib/planner/transaction';
import type { Term } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { conflictReasonText } from '@/features/planner/conflictText';
import { ConflictCallout } from './ConflictCallout';
import { addSectionName } from './SectionRow';

const ACTION = `inline-flex items-center gap-1 whitespace-nowrap rounded-kcp border border-primary px-2 py-0.5 text-primary-strong hover:bg-primary-soft ${TARGET_SIZE} ${FOCUS_RING}`;

export const ADD_CELL =
  'sticky right-0 z-[1] border-b border-l border-border px-2 py-1.5 text-left align-top';

/** What the table's live node says once an add from the table settles. */
export function addOutcomeText(
  outcome: AddOutcome,
  section: Section,
  t: Translate,
): string {
  if (outcome.ok) {
    return fillTemplate(t('toast.added'), {
      subject: section.subjectId,
      section: section.section,
    });
  }
  if ('crossTerm' in outcome) {
    return t('section.badge.differentTerm');
  }
  const description = describeConflicts(outcome.conflicts);
  return description === null
    ? t('compare.cannotAdd')
    : conflictReasonText(description, t);
}

interface ComparisonAddCellProps {
  row: ComparisonRow;
  /** The row's surface class, so the pinned cell hides the cells under it. */
  surface: string;
  /** Whether the student's last add from this row was blocked. */
  blocked: boolean;
  t: Translate;
  onAdd: (section: Section) => void;
  onSwitchTerm: (term: Term) => void;
}

export function ComparisonAddCell({
  row,
  surface,
  blocked,
  t,
  onAdd,
  onSwitchTerm,
}: ComparisonAddCellProps) {
  const calloutId = useId();
  const { section, relation, seat } = row;
  const className = `${ADD_CELL} ${surface}`;

  if (relation.kind === 'added') {
    return (
      <td className={className}>
        <span className="inline-flex items-center gap-1 text-success">
          <Check size={12} strokeWidth={2.5} aria-hidden />
          {t('section.badge.added')}
        </span>
      </td>
    );
  }
  if (relation.kind === 'different_term') {
    return (
      <td className={className}>
        <button
          type="button"
          onClick={() => {
            onSwitchTerm(relation.browsedTerm);
          }}
          className={ACTION}
        >
          {t('term.switch')}
        </button>
      </td>
    );
  }
  if (relation.kind === 'duplicate' || seat.kind !== 'open') {
    return (
      <td className={className}>
        <span className="text-ink-soft">{t('compare.cannotAdd')}</span>
      </td>
    );
  }
  // The callout reads the row's current conflicts rather than the rejected outcome, so
  // it stays true when the plan changes under the open table.
  const conflict =
    blocked && relation.kind === 'conflicting'
      ? describeConflicts(relation.conflicts)
      : null;
  return (
    <td className={className}>
      <button
        type="button"
        aria-label={addSectionName(section, t)}
        {...(conflict !== null ? { 'aria-describedby': calloutId } : {})}
        onClick={() => {
          onAdd(section);
        }}
        className={ACTION}
      >
        <Plus size={12} strokeWidth={2.5} aria-hidden />
        {t('action.add')}
      </button>
      {conflict !== null ? (
        <ConflictCallout id={calloutId} description={conflict} t={t} />
      ) : null}
    </td>
  );
}
