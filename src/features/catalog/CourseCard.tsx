// A course card: a header with the subject id, the locale primary name and the credit
// string, which is also the disclosure for the card's sections. A second line inside
// the toggle summarizes the course's fit, so a collapsed card answers whether opening
// it is worth it. Each section's seat status and plan relation are computed here from
// the placed sections. A card starts collapsed and the catalog owns whether it is
// open, so the state survives a remount.
// Resting the mouse on the header, or focusing the toggle from the keyboard, previews
// where the course's sections would land on the grid.

import { memo, useId, useMemo, type PointerEvent, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, GripVertical } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import { termsEqual, type Term } from '@/lib/routing/academicTerms';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import {
  summarizeCourse,
  type CourseSummary,
} from '@/lib/catalog/courseSummary';
import {
  computeSectionRelation,
  type TermContext,
} from '@/lib/planner/sectionState';
import { DraggableSection } from './DraggableSection';
import { SectionRow } from './SectionRow';
import { RemoveButton, removeSectionName } from './RemoveButton';
import { AddedLine, FitLine } from './CourseMeta';
import { CourseBody, DISCLOSURE_MS } from './CourseBody';
import { FOCUS_RING } from '@/lib/ui/focus';
import { useRevealOnExpand } from './useRevealOnExpand';
import {
  dragSourceClass,
  useTouchPress,
} from '@/features/planner/useTouchPress';
import { useCoursePreview } from './useCoursePreview';
import type { HoverIntentHandlers } from './useHoverIntent';

const HEADER = 'flex items-start gap-1';

// The whole card header is a pointer drag source. Grabbing it previews every section of
// the course as a candidate slot on the grid, and dnd-kit swallows the click that ends
// an activated drag, so a drag never toggles the card. The drag has no keyboard path and
// no accessible name: keyboard users open the card and add a specific section through
// its rows (ADR-0024, amended by ADR-0057). On a touch screen a swipe on the header
// scrolls the list, a tap toggles the card, and a long press starts the course drag,
// with the header marked pressed on the way and dimmed once it drags (ADR-0058).
function CourseDragHeader({
  course,
  hover,
  children,
}: {
  course: Course;
  hover: HoverIntentHandlers;
  children: ReactNode;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `course-${course.subjectId}`,
    data: { course },
  });
  const press = useTouchPress();
  // The press and the hover intent both follow the pointer, so one move feeds both.
  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    press.handlers.onPointerMove(event);
    hover.onPointerMove(event);
  };
  return (
    <header
      ref={setNodeRef}
      {...press.handlers}
      {...listeners}
      {...hover}
      onPointerMove={handlePointerMove}
      data-drag-surface="course"
      className={`${HEADER} touch-drag rounded-kcp ${dragSourceClass(isDragging, press.pressed)}`}
    >
      {children}
    </header>
  );
}

interface CourseCardProps {
  course: Course;
  placed: Section[];
  locale: Locale;
  t: Translate;
  term?: TermContext | undefined;
  /** Whether the sections show, decided by the catalog. */
  open: boolean;
  /** Skip the open or close transition, for a change made to many cards at once. */
  instant: boolean;
  onToggle: (subjectId: string, open: boolean, added: boolean) => void;
  onAdd?: ((course: Course, section: Section) => void) | undefined;
  onRemove?: ((teachTableId: string) => void) | undefined;
  onSwitchTerm?: ((term: Term) => void) | undefined;
}

/** The second line of the toggle: the placed section, or the course summary. */
type CardMeta =
  { added: true; section: Section } | { added: false; summary: CourseSummary };

function isCrossTerm(term: TermContext | undefined): boolean {
  return (
    term?.planTerm != null &&
    term.browsedTerm != null &&
    !termsEqual(term.planTerm, term.browsedTerm)
  );
}

// Memoized: the catalog holds hundreds of cards, and a re-render that leaves a
// card's inputs unchanged (a filter that drops nothing, a language toggle, a plan
// change that does not touch this course) skips its whole subtree. The default
// shallow comparison is sufficient because the parent keeps every prop identity
// stable: the course reference survives an unfiltering pass (filterCourses), the
// callbacks and term are memoized, open and instant are booleans, and placed
// changes only when the plan does.
function CourseCardComponent({
  course,
  placed,
  locale,
  t,
  term,
  open,
  instant,
  onToggle,
  onAdd,
  onRemove,
  onSwitchTerm,
}: CourseCardProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const creditId = `${id}-credit`;
  const metaId = `${id}-meta`;
  const bodyId = `${id}-body`;
  const primary = locale === 'th' ? course.nameTh : course.nameEn;
  const secondary = locale === 'th' ? course.nameEn : course.nameTh;
  // The secondary name is the other language's field, so it carries that language for
  // a screen reader voice; the primary inherits the panel language.
  const secondaryLang: Locale = locale === 'th' ? 'en' : 'th';
  const hasSecondary = secondary !== '' && secondary !== primary;
  const placedSection = placed.find((p) => p.subjectId === course.subjectId);
  const added = placedSection !== undefined;
  // A cross term course cannot be added, so its header is no drag source; its rows
  // carry the different term state and a switch action instead.
  const crossTerm = isCrossTerm(term);
  const draggable = !added && onAdd !== undefined && !crossTerm;
  // The card receives the filtered course, so the summary counts what opening shows.
  // placed changes identity only when the plan does, so the candidates rerun rarely.
  // An added card names its placed section instead, so it skips the candidates.
  const meta = useMemo<CardMeta>(
    () =>
      placedSection === undefined
        ? {
            added: false,
            summary: summarizeCourse(course, placed, crossTerm, locale),
          }
        : { added: true, section: placedSection },
    [placedSection, course, placed, crossTerm, locale],
  );
  const preview = useCoursePreview(course, !added && !crossTerm);
  const { cardRef, scheduleReveal } = useRevealOnExpand(DISCLOSURE_MS);
  const handleToggle = () => {
    scheduleReveal(!open);
    onToggle(course.subjectId, !open, added);
  };

  // The title clamps to two lines and breaks inside a long Thai word rather than
  // cutting to one line, so the name stays readable without a tooltip, which could
  // not sit inside the button. The button is named by the title and the credits and
  // described by the summary line under them.
  const headerContent = (
    <>
      {draggable ? (
        <GripVertical
          size={14}
          strokeWidth={2}
          aria-hidden
          className="mt-0.5 shrink-0 cursor-grab text-ink-soft"
        />
      ) : null}
      <h4 className="flex min-w-0 flex-1">
        <button
          type="button"
          data-course-toggle
          aria-expanded={open}
          aria-controls={bodyId}
          aria-labelledby={`${titleId} ${creditId}`}
          aria-describedby={metaId}
          onClick={handleToggle}
          {...preview.focus}
          className={`group flex min-h-6 min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-kcp text-left pointer-coarse:min-h-11 ${FOCUS_RING}`}
        >
          <span className="flex w-full min-w-0 items-start gap-2">
            <span
              id={titleId}
              className="line-clamp-2 min-w-0 flex-1 break-words text-ink"
            >
              <span className="font-semibold tabular-nums">
                {course.subjectId}
              </span>{' '}
              {primary}
            </span>
            <span id={creditId} className="shrink-0 text-xs text-ink-soft">
              {course.creditStr}
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className={`mt-0.5 shrink-0 text-ink-soft transition-transform duration-fast group-hover:text-ink motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            />
          </span>
          {meta.added ? (
            <AddedLine id={metaId} section={meta.section} t={t} />
          ) : (
            <FitLine id={metaId} summary={meta.summary} t={t} />
          )}
        </button>
      </h4>
      {placedSection !== undefined && onRemove !== undefined ? (
        <RemoveButton
          label={t('action.remove')}
          accessibleName={removeSectionName(
            t,
            placedSection.subjectId,
            placedSection.section,
          )}
          onRemove={() => {
            onRemove(placedSection.teachTableId);
          }}
        />
      ) : null}
    </>
  );

  // An added card de-emphasizes with a muted surface rather than opacity, which would
  // drop text below AA. It opens to its sections read only for reference, since a
  // second section of the same subject cannot be added; changing section happens on
  // the grid.
  return (
    <article
      ref={cardRef}
      data-course-card={course.subjectId}
      className={`rounded-kcp border border-border px-3 py-2 hover:border-ink-soft ${added ? 'bg-surface-alt' : 'bg-surface'}`}
    >
      {draggable ? (
        <CourseDragHeader course={course} hover={preview.hover}>
          {headerContent}
        </CourseDragHeader>
      ) : (
        <header className={HEADER} {...preview.hover}>
          {headerContent}
        </header>
      )}
      {/* Keyed by placement: an add or a remove remounts the body at its new state
          with no transition, so a card never plays the exit of rows that just
          became read only or addable again. */}
      <CourseBody
        key={added ? 'added' : 'unadded'}
        id={bodyId}
        open={open}
        instant={instant}
        renderContent={() => (
          <div className="flex flex-col gap-1.5 pt-2">
            {/* The full name repeats for the eye when the title clamps; the button
                already reads it, so it is hidden from assistive technology. */}
            <p className="text-xs break-words">
              <span aria-hidden className="text-ink">
                {primary}
              </span>
              {hasSecondary ? (
                <span lang={secondaryLang} className="ml-1 text-ink-soft">
                  {secondary}
                </span>
              ) : null}
            </p>
            {added ? (
              <p className="text-xs text-ink-soft">
                {t('catalog.card.addedHint')}
              </p>
            ) : null}
            {course.sections.map((section) => (
              <CourseSection
                key={section.teachTableId}
                course={course}
                section={section}
                placed={placed}
                locale={locale}
                t={t}
                term={term}
                readOnly={added}
                onAdd={onAdd}
                onRemove={onRemove}
                onSwitchTerm={onSwitchTerm}
              />
            ))}
          </div>
        )}
      />
    </article>
  );
}

interface CourseSectionProps {
  course: Course;
  section: Section;
  placed: Section[];
  locale: Locale;
  t: Translate;
  term: TermContext | undefined;
  readOnly: boolean;
  onAdd: ((course: Course, section: Section) => void) | undefined;
  onRemove: ((teachTableId: string) => void) | undefined;
  onSwitchTerm: ((term: Term) => void) | undefined;
}

// One section row of an open card. An addable or conflicting open row is a section
// drag source; the rows of an added card are read only.
function CourseSection({
  course,
  section,
  placed,
  locale,
  t,
  term,
  readOnly,
  onAdd,
  onRemove,
  onSwitchTerm,
}: CourseSectionProps) {
  const relation = computeSectionRelation(placed, course, section, term);
  const seat = computeSeatStatus(section);
  const row = readOnly ? (
    <SectionRow
      course={course}
      section={section}
      relation={relation}
      seat={seat}
      locale={locale}
      t={t}
      readOnly
    />
  ) : (
    <SectionRow
      course={course}
      section={section}
      relation={relation}
      seat={seat}
      locale={locale}
      t={t}
      onAdd={onAdd}
      onRemove={onRemove}
      onSwitchTerm={onSwitchTerm}
    />
  );
  const dragSource =
    !readOnly &&
    (relation.kind === 'addable' || relation.kind === 'conflicting') &&
    seat.kind === 'open';
  if (!dragSource) return row;
  return (
    <DraggableSection
      id={section.teachTableId}
      course={course}
      section={section}
      label={`${t('action.drag')} ${section.subjectId} ${t('section.code')} ${section.section}`}
      onActivate={() => {
        onAdd?.(course, section);
      }}
    >
      {row}
    </DraggableSection>
  );
}

export const CourseCard = memo(CourseCardComponent);
