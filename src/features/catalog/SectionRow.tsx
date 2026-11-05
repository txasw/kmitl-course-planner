// A single section row inside a course card. It shows the section code, a quiet
// lecture or practice tag, each meeting's day, time, and room, the instructors, the
// seat line, and one status badge chosen by the rowStatus precedence. A conflicting
// section keeps its badge, which reads as an exam clash when every conflict is an exam
// overlap, and its reason but stays actionable: its add button routes to the blocked
// feedback strip instead of being disabled, so a keyboard user gets the same reason
// and alternatives a drag would give. A duplicate reads on a muted surface with its
// reason. When handlers are supplied the row offers an add button for an addable or
// conflicting open section and a remove button for an added one.

import { useId, useState } from 'react';
import { Info, Plus } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { RemoveButton, removeSectionName } from './RemoveButton';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import { computeSeatDemand, seatLineText } from '@/lib/catalog/seatDemand';
import { computeRowStatus, isConflictStatus } from '@/lib/catalog/rowStatus';
import type { SectionRelation } from '@/lib/planner/sectionState';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { ConflictCallout } from './ConflictCallout';
import { SeatDemand } from './SeatDemand';
import { StatusBadge } from './StatusBadge';
import { meetingLabel } from './meetingFormat';

function termLabel(term: Term): string {
  return `${term.semester}/${term.year}`;
}

function termReason(planTerm: Term, browsedTerm: Term, t: Translate): string {
  return `${t('term.planIs')} ${termLabel(planTerm)}. ${t('term.sectionIs')} ${termLabel(browsedTerm)}`;
}

interface SectionRowProps {
  course: Course;
  section: Section;
  relation: SectionRelation;
  seat: SeatStatus;
  locale: Locale;
  t: Translate;
  onAdd?: ((course: Course, section: Section) => void) | undefined;
  onRemove?: ((teachTableId: string) => void) | undefined;
  onSwitchTerm?: ((term: Term) => void) | undefined;
  /** Reference only: no action buttons, no state badge, no reason lines. Used by the
   * collapsed added course card when its sections are revealed. */
  readOnly?: boolean;
}

export function SectionRow({
  course,
  section,
  relation,
  seat,
  locale,
  t,
  onAdd,
  onRemove,
  onSwitchTerm,
  readOnly = false,
}: SectionRowProps) {
  const kind = section.kind;
  const teachers = locale === 'th' ? section.teachersTh : section.teachersEn;
  // A duplicate subject or different term row de-emphasizes with the muted surface
  // while its text keeps the ink and ink soft tokens, the treatment the collapsed
  // added course card uses. Opacity would composite every child, dropping the reason
  // text and the switch term action below AA (ADR-0051).
  const dimmed =
    relation.kind === 'duplicate' || relation.kind === 'different_term';
  // The add affordance is a full height rail on the trailing edge rather than a
  // button in the wrapping controls strip, so it stays inside the row bounds. A
  // section that cannot be added shows the rail disabled with the reason in the row
  // body rather than omitting it, keeping the trailing edge consistent.
  const rail = readOnly
    ? 'none'
    : railKind(relation, seat, onAdd !== undefined);
  const addLabel = `${t('action.add')} ${section.subjectId} ${t('section.code')} ${section.section}`;
  const [showDetails, setShowDetails] = useState(false);
  const calloutId = useId();
  const reasonId = useId();
  const demand = computeSeatDemand(section);
  // A disabled rail names the reason the row body already states: the term mismatch,
  // which outranks the seat state, or the full or closed seat line.
  const disabledReason =
    relation.kind === 'different_term'
      ? termReason(relation.planTerm, relation.browsedTerm, t)
      : seatLineText(demand, t);
  const status = readOnly ? null : computeRowStatus(relation, seat);
  // The callout follows the badge: a full or closed row that also clashes shows only
  // its seat state and reason, since the section cannot be added by any path.
  const conflict =
    relation.kind === 'conflicting' && isConflictStatus(status)
      ? describeConflicts(relation.conflicts)
      : null;

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-kcp border border-border text-xs ${
        dimmed ? 'bg-surface-alt' : ''
      }`}
    >
      <div className="min-w-0 flex-1 p-2">
        {/* The badge cluster wraps under the section code on a narrow row rather than
            shrinking, so the status label never collapses to an icon. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-sm font-semibold text-ink">
            {t('section.code')} {section.section}
          </span>
          <span className="text-ink-soft">
            {kind === 'practice' ? t('section.practice') : t('section.lecture')}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            <StatusBadge status={status} t={t} />
            {!readOnly &&
            relation.kind === 'added' &&
            onRemove !== undefined ? (
              <RemoveButton
                label={t('action.remove')}
                accessibleName={removeSectionName(
                  t,
                  section.subjectId,
                  section.section,
                )}
                onRemove={() => {
                  onRemove(section.teachTableId);
                }}
              />
            ) : null}
            {!readOnly &&
            relation.kind === 'different_term' &&
            onSwitchTerm !== undefined ? (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  onSwitchTerm(relation.browsedTerm);
                }}
                className="rounded-kcp border border-primary px-2 py-0.5 text-primary-strong outline-none hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t('term.switch')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-0.5 text-ink-soft">
          {section.meetings.map((meeting) => (
            <span
              key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
            >
              {meetingLabel(meeting, t)}
              {meeting.building !== '' || meeting.room !== ''
                ? ` ${meeting.building} ${meeting.room}`.trimEnd()
                : ''}
            </span>
          ))}
        </div>

        {teachers.length > 0 || section.remark !== '' ? (
          <div className="mt-1 flex items-center gap-1 text-ink-soft">
            {teachers.length > 0 ? (
              <Tooltip label={teachers.join(', ')}>
                {(triggerProps, ref) => (
                  <p
                    ref={ref}
                    {...triggerProps}
                    className="min-w-0 flex-1 truncate"
                  >
                    {teachers.join(', ')}
                  </p>
                )}
              </Tooltip>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {!readOnly && section.remark !== '' ? (
              <button
                type="button"
                aria-expanded={showDetails}
                aria-label={t('section.moreInfo')}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  setShowDetails((value) => !value);
                }}
                className={`shrink-0 rounded-kcp p-0.5 hover:text-ink ${FOCUS_RING}`}
              >
                <Info size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          className="mt-1"
          id={relation.kind === 'different_term' ? undefined : reasonId}
        >
          <SeatDemand demand={demand} t={t} />
        </div>
        {!readOnly && showDetails && section.remark !== '' ? (
          <p className="mt-1 whitespace-pre-line text-ink-soft">
            {section.remark}
          </p>
        ) : null}

        {conflict !== null ? (
          <ConflictCallout id={calloutId} description={conflict} t={t} />
        ) : null}
        {!readOnly && relation.kind === 'duplicate' ? (
          <p className="mt-1 text-warn">{t('section.reason.duplicate')}</p>
        ) : null}
        {!readOnly && relation.kind === 'different_term' ? (
          <p id={reasonId} className="mt-1 text-ink-soft">
            {termReason(relation.planTerm, relation.browsedTerm, t)}
          </p>
        ) : null}
      </div>
      {rail === 'add' && onAdd !== undefined ? (
        <AddRail
          label={addLabel}
          describedBy={conflict !== null ? calloutId : undefined}
          onAdd={() => {
            onAdd(course, section);
          }}
        />
      ) : rail === 'disabled' ? (
        <DisabledRail
          label={addLabel}
          reason={disabledReason}
          reasonId={reasonId}
        />
      ) : null}
    </div>
  );
}

type RailKind = 'add' | 'disabled' | 'none';

/**
 * The trailing rail state for a section. A read only row has no rail. A row that is
 * added or a duplicate subject has none either, since neither can be added. A full,
 * closed, or different term section shows a disabled rail with the reason in the row
 * body. Otherwise an addable or a conflicting open section shows the add rail; a
 * conflicting add routes to the blocked feedback like the drag does.
 */
function railKind(
  relation: SectionRelation,
  seat: SeatStatus,
  hasAdd: boolean,
): RailKind {
  if (relation.kind === 'added' || relation.kind === 'duplicate') {
    return 'none';
  }
  if (seat.kind === 'full' || seat.kind === 'closed') {
    return 'disabled';
  }
  if (relation.kind === 'different_term') {
    return 'disabled';
  }
  // relation.kind is now addable or conflicting, both addable while the seat is open;
  // a conflicting add routes to the blocked feedback like a drag does.
  return hasAdd ? 'add' : 'none';
}

// The add rail is a quiet affordance, not the primary path: drag is primary, add is
// secondary. It rests as a soft tinted column with the accent icon and fills to solid
// only on hover and focus. Its own bordered column (w-8, shrink-0, border-l) means it
// never overlaps the row body, which stays min-w-0 and clips rather than spilling into
// the rail at any card width. The accent icon on the soft surface and white on the
// solid hover fill both clear the AA text bar (token-contrast.test.ts). On a conflicting
// row its description points at the conflict callout, so a screen reader hears why the
// add will route to the blocked feedback before pressing it.
function AddRail({
  label,
  describedBy,
  onAdd,
}: {
  label: string;
  describedBy: string | undefined;
  onAdd: () => void;
}) {
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={label}
          {...(describedBy !== undefined
            ? { 'aria-describedby': describedBy }
            : {})}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={onAdd}
          className={`flex w-8 shrink-0 items-center justify-center border-l border-border bg-primary-soft text-primary-strong hover:bg-primary-strong hover:text-white focus-visible:bg-primary-strong focus-visible:text-white ${FOCUS_OUTLINE}`}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </Tooltip>
  );
}

// A section that cannot be added keeps its rail so the trailing edge stays consistent.
// The rail is aria-disabled rather than disabled, so it stays in the tab order: a
// keyboard user who reaches it hears the reason through aria-describedby, and a pointer
// user sees it in the tooltip. The reason itself is always visible in the row body.
function DisabledRail({
  label,
  reason,
  reasonId,
}: {
  label: string;
  reason: string;
  reasonId: string;
}) {
  return (
    <Tooltip label={reason}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-disabled="true"
          aria-label={label}
          aria-describedby={reasonId}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          className={`flex w-8 shrink-0 cursor-not-allowed items-center justify-center border-l border-border bg-surface-alt text-ink-soft ${FOCUS_OUTLINE}`}
        >
          <Plus size={16} aria-hidden className="opacity-40" />
        </button>
      )}
    </Tooltip>
  );
}
