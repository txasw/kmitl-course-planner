// A single section row inside a course card. It shows the section code, a quiet
// lecture or practice tag, each meeting's day, time, and room, the instructors, the
// seat line with a demand chip when pre registrations exceed the capacity, the
// midterm and final exam dates, the enrollment conditions and the remark at two
// wrapped lines each with a control that shows the rest when longer, and one status
// badge chosen by the rowStatus precedence. The exam dates, conditions, and remark show
// on a read only row too, since they are facts about the section rather than actions. A
// conflicting section keeps its badge, which reads as an exam clash when every conflict
// is an exam overlap, and its reason but stays actionable: its add button routes to the
// blocked feedback strip instead of being disabled, so a keyboard user gets the same
// reason and alternatives a drag would give.
// A duplicate reads on a muted surface with its reason. When an add handler is supplied
// the row offers an add button for an addable or conflicting open section. An added
// section only ever renders read only, inside the added course card, whose header
// carries the remove control.

import { useId } from 'react';
import { Plus } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import type { Locale, Translate } from '@/lib/i18n/t';
import { termMismatchText } from '@/lib/i18n/termCopy';
import type { Course, Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import { computeSeatDemand, seatLineText } from '@/lib/catalog/seatDemand';
import { computeRowStatus, isConflictStatus } from '@/lib/catalog/rowStatus';
import type { SectionRelation } from '@/lib/planner/sectionState';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { NO_DRAG_ARMING } from '@/features/planner/dragArming';
import { TermSwitchLabel } from '@/features/plans/TermSwitchLabel';
import { ConflictCallout } from './ConflictCallout';
import { ExamLine } from './ExamLine';
import { RemarkLine } from './RemarkLine';
import { RulesNotice } from './RulesNotice';
import { DemandChip, SeatDemand } from './SeatDemand';
import { StatusBadge } from './StatusBadge';
import { TeacherLine } from './TeacherLine';
import { meetingLabel, meetingPlace } from './meetingFormat';
import { tourTargetProps } from '@/lib/onboarding/tour';

/** The accessible name of a section's add control: the action, the subject id and the
 * section, for example เพิ่ม 90592033 กลุ่มเรียน 901. */
export function addSectionName(section: Section, t: Translate): string {
  return `${t('action.add')} ${section.subjectId} ${t('section.code')} ${section.section}`;
}

interface SectionRowProps {
  course: Course;
  section: Section;
  relation: SectionRelation;
  seat: SeatStatus;
  locale: Locale;
  t: Translate;
  onAdd?: ((course: Course, section: Section) => void) | undefined;
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
  // The add affordance is a compact button in its own column at the top right of the
  // row, beside the section code, so it never runs down the row as a tinted strip and
  // never overlaps the row body. A section that cannot be added shows the button
  // disabled with the reason in the row body rather than omitting it, keeping the
  // column consistent.
  const action = readOnly
    ? 'none'
    : actionKind(relation, seat, onAdd !== undefined);
  const addLabel = addSectionName(section, t);
  const calloutId = useId();
  const reasonId = useId();
  const demand = computeSeatDemand(section);
  // A disabled add names the reason the row body already states: the term mismatch,
  // which outranks the seat state, or the full or closed seat line.
  const disabledReason =
    relation.kind === 'different_term'
      ? termMismatchText(relation.planTerm, relation.browsedTerm, 'section', t)
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
      data-section-row
      className={`flex items-start gap-2 p-2 text-xs ${dimmed ? 'bg-surface-alt' : ''}`}
    >
      <div className="min-w-0 flex-1">
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
            relation.kind === 'different_term' &&
            onSwitchTerm !== undefined ? (
              <button
                type="button"
                {...NO_DRAG_ARMING}
                onClick={() => {
                  onSwitchTerm(relation.browsedTerm);
                }}
                className={`rounded-kcp border border-primary px-2 py-1 text-primary-strong hover:bg-primary-soft ${FOCUS_RING} ${TARGET_SIZE}`}
              >
                <TermSwitchLabel term={relation.browsedTerm} t={t} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-1 text-ink-soft">
          {section.meetings.map((meeting) => (
            <span
              key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
            >
              {meetingLabel(meeting, t)}
              {` ${meetingPlace(meeting)}`.trimEnd()}
            </span>
          ))}
        </div>

        <TeacherLine teachers={teachers} t={t} />
        {/* The reason id stays on the seat line alone, so a disabled add names the seat
            state without the demand counts. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <div id={relation.kind === 'different_term' ? undefined : reasonId}>
            <SeatDemand demand={demand} t={t} />
          </div>
          <DemandChip demand={demand} t={t} />
        </div>
        <ExamLine exam={section.exam} t={t} />
        <RulesNotice
          rulesTh={section.rulesTh}
          rulesEn={section.rulesEn}
          locale={locale}
          t={t}
        />
        <RemarkLine remark={section.remark} t={t} />

        {conflict !== null ? (
          <ConflictCallout id={calloutId} description={conflict} t={t} />
        ) : null}
        {!readOnly && relation.kind === 'duplicate' ? (
          <p className="mt-1 text-warn">{t('section.reason.duplicate')}</p>
        ) : null}
        {!readOnly && relation.kind === 'different_term' ? (
          <p id={reasonId} className="mt-1 text-ink-soft">
            {termMismatchText(
              relation.planTerm,
              relation.browsedTerm,
              'section',
              t,
            )}
          </p>
        ) : null}
      </div>
      {action === 'add' && onAdd !== undefined ? (
        <AddButton
          text={t('action.add')}
          label={addLabel}
          describedBy={conflict !== null ? calloutId : undefined}
          onAdd={() => {
            onAdd(course, section);
          }}
        />
      ) : action === 'disabled' ? (
        <DisabledAddButton
          text={t('action.add')}
          label={addLabel}
          reason={disabledReason}
          reasonId={reasonId}
        />
      ) : null}
    </div>
  );
}

type ActionKind = 'add' | 'disabled' | 'none';

/**
 * The add control state for a section. A read only row has none. A row that is added or
 * a duplicate subject has none either, since neither can be added. A full, closed, or
 * different term section shows the add disabled with the reason in the row body.
 * Otherwise an addable or a conflicting open section shows the add; a conflicting add
 * routes to the blocked feedback like the drag does.
 */
function actionKind(
  relation: SectionRelation,
  seat: SeatStatus,
  hasAdd: boolean,
): ActionKind {
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

// The add is a quiet secondary affordance, since drag is primary: a white button with a
// hairline edge, the accent plus, and the short add word, sized to its content and
// pinned to the top of its own shrink-0 column, so the row body beside it stays min-w-0
// and wraps rather than running under it at any width. It meets the 24 px target and
// grows to 44 px under a coarse pointer. Its accessible name starts with the visible word
// and names the subject and section it adds. On a conflicting row its description points
// at the conflict callout, so a screen reader hears why the add will route to the
// blocked feedback before pressing it.
const ADD_BUTTON = `inline-flex shrink-0 items-center justify-center gap-1 rounded-kcp-sm border px-2 text-xs font-semibold whitespace-nowrap ${TARGET_SIZE} ${FOCUS_RING}`;

function AddButton({
  text,
  label,
  describedBy,
  onAdd,
}: {
  text: string;
  label: string;
  describedBy: string | undefined;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...(describedBy !== undefined
        ? { 'aria-describedby': describedBy }
        : {})}
      {...NO_DRAG_ARMING}
      {...tourTargetProps('add')}
      onClick={onAdd}
      className={`${ADD_BUTTON} border-border bg-surface text-ink shadow-kcp-soft hover:border-primary hover:bg-primary-soft hover:text-primary-strong`}
    >
      <Plus
        size={14}
        strokeWidth={2.5}
        aria-hidden
        className="text-primary-strong"
      />
      {text}
    </button>
  );
}

// A section that cannot be added keeps its add, disabled, so the column stays consistent.
// It is aria-disabled rather than disabled, so it stays in the tab order: a keyboard user
// who reaches it hears the reason through aria-describedby, and a pointer user sees it in
// the tooltip. The reason itself is always visible in the row body.
function DisabledAddButton({
  text,
  label,
  reason,
  reasonId,
}: {
  text: string;
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
          {...NO_DRAG_ARMING}
          className={`${ADD_BUTTON} cursor-not-allowed border-border bg-surface-alt text-ink-soft`}
        >
          <Plus size={14} aria-hidden />
          {text}
        </button>
      )}
    </Tooltip>
  );
}
