// A course card: the subject id, the locale primary name with the other language
// as secondary text, the credit string, and one row per section. Each section's
// seat status and plan relation are computed here from the placed sections.

import { Fragment, memo, useCallback, useState, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, GripVertical } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import { termsEqual, type Term } from '@/lib/routing/academicTerms';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import {
  computeSectionRelation,
  type TermContext,
} from '@/lib/planner/sectionState';
import { DraggableSection } from './DraggableSection';
import { SectionRow } from './SectionRow';
import { FOCUS_RING } from '@/lib/ui/focus';
import { Tooltip } from '@/components/Tooltip';

// The whole card header is a pointer drag source. Grabbing it previews every section of
// the course as a candidate slot on the grid. The grip rendered inside is the visual hint
// only; the header carries no keyboard handler on purpose, because keyboard users add a
// specific section through the per section add buttons, so it stays out of the tab order
// (ADR-0024).
function CourseDragHeader({
  course,
  label,
  children,
}: {
  course: Course;
  label: string;
  children: ReactNode;
}) {
  const { setNodeRef, listeners } = useDraggable({
    id: `course-${course.subjectId}`,
    data: { course },
  });
  return (
    <Tooltip label={label}>
      {(triggerProps, tooltipRef) => (
        <DragCourseHeader
          setNodeRef={setNodeRef}
          tooltipRef={tooltipRef}
          listeners={listeners}
          triggerProps={triggerProps}
        >
          {children}
        </DragCourseHeader>
      )}
    </Tooltip>
  );
}

// A small element wrapper so the drag node ref and the tooltip reference ref merge
// through one memoized callback, which the refs lint rule requires; merging them
// inline would read the refs during render.
function DragCourseHeader({
  setNodeRef,
  tooltipRef,
  listeners,
  triggerProps,
  children,
}: {
  setNodeRef: (node: HTMLElement | null) => void;
  tooltipRef: (node: Element | null) => void;
  listeners: ReturnType<typeof useDraggable>['listeners'];
  triggerProps: Record<string, unknown>;
  children: ReactNode;
}) {
  const ref = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      tooltipRef(node);
    },
    [setNodeRef, tooltipRef],
  );
  return (
    <header
      ref={ref}
      {...listeners}
      {...triggerProps}
      data-drag-surface="course"
      className="flex touch-none cursor-grab items-baseline justify-between gap-2"
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
  onAdd?: ((course: Course, section: Section) => void) | undefined;
  onRemove?: ((teachTableId: string) => void) | undefined;
  onSwitchTerm?: ((term: Term) => void) | undefined;
}

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
// callbacks and term are memoized, and placed changes only when the plan does.
function CourseCardComponent({
  course,
  placed,
  locale,
  t,
  term,
  onAdd,
  onRemove,
  onSwitchTerm,
}: CourseCardProps) {
  const primary = locale === 'th' ? course.nameTh : course.nameEn;
  const secondary = locale === 'th' ? course.nameEn : course.nameTh;
  const hasSecondary = secondary !== '' && secondary !== primary;
  // A long Thai name has no word breaks, so the name line truncates rather than
  // overflowing the card, and the full text rides on a tooltip for a hover.
  const fullName = hasSecondary
    ? `${course.subjectId} ${primary} ${secondary}`
    : `${course.subjectId} ${primary}`;
  const [expanded, setExpanded] = useState(false);
  const placedSection = placed.find((p) => p.subjectId === course.subjectId);

  // Once any section of a subject is in the plan the card collapses to a dim summary,
  // since a second section of the same subject cannot be added. It de-emphasizes with a
  // muted surface and ink-soft meta rather than opacity, which would drop text below AA.
  // It expands to its sections read only for reference; changing section happens by
  // dragging the block on the grid.
  if (placedSection !== undefined) {
    return (
      <article className="rounded-kcp border border-border bg-surface-alt p-3">
        <header className="flex items-baseline justify-between gap-2">
          <Tooltip label={fullName}>
            {(triggerProps, ref) => (
              <div ref={ref} {...triggerProps} className="min-w-0 truncate">
                <span className="font-semibold text-ink">
                  {course.subjectId}
                </span>{' '}
                <span className="text-ink">{primary}</span>
                {hasSecondary ? (
                  <span className="ml-1 text-ink-soft">{secondary}</span>
                ) : null}
              </div>
            )}
          </Tooltip>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-ink-soft">{course.creditStr}</span>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={
                expanded ? t('catalog.card.collapse') : t('catalog.card.expand')
              }
              onClick={() => {
                setExpanded((value) => !value);
              }}
              className={`rounded-kcp p-0.5 text-ink-soft hover:text-ink ${FOCUS_RING}`}
            >
              <ChevronDown
                size={16}
                aria-hidden
                className={expanded ? 'rotate-180' : ''}
              />
            </button>
            {onRemove !== undefined ? (
              <button
                type="button"
                onClick={() => {
                  onRemove(placedSection.teachTableId);
                }}
                className={`rounded-kcp border border-border px-2 py-0.5 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink ${FOCUS_RING}`}
              >
                {t('action.remove')}
              </button>
            ) : null}
          </div>
        </header>
        {expanded ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-xs text-ink-soft">
              {t('catalog.card.addedHint')}
            </p>
            {course.sections.map((section) => (
              <SectionRow
                key={section.teachTableId}
                course={course}
                section={section}
                relation={computeSectionRelation(placed, course, section, term)}
                seat={computeSeatStatus(section)}
                locale={locale}
                t={t}
                readOnly
              />
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  // A cross term course cannot be added, so its whole course drag header is inert; its
  // rows carry the different term state and a switch action instead.
  const crossTerm = isCrossTerm(term);
  const draggable = onAdd !== undefined && !crossTerm;
  const headerContent = (
    <>
      <div className="flex min-w-0 items-baseline gap-1">
        {draggable ? (
          <GripVertical
            size={14}
            strokeWidth={2}
            aria-hidden
            className="shrink-0 self-center text-ink-soft"
          />
        ) : null}
        <Tooltip label={fullName}>
          {(triggerProps, ref) => (
            <div ref={ref} {...triggerProps} className="min-w-0 truncate">
              <span className="font-semibold text-ink">{course.subjectId}</span>{' '}
              <span className="text-ink">{primary}</span>
              {hasSecondary ? (
                <span className="ml-1 text-ink-soft">{secondary}</span>
              ) : null}
            </div>
          )}
        </Tooltip>
      </div>
      <span className="shrink-0 text-xs text-ink-soft">{course.creditStr}</span>
    </>
  );

  return (
    <article className="rounded-kcp border border-border p-3">
      {draggable ? (
        <CourseDragHeader
          course={course}
          label={`${t('action.dragCourse')} ${course.subjectId}`}
        >
          {headerContent}
        </CourseDragHeader>
      ) : (
        <header className="flex items-baseline justify-between gap-2">
          {headerContent}
        </header>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        {course.sections.map((section) => {
          const relation = computeSectionRelation(
            placed,
            course,
            section,
            term,
          );
          const seat = computeSeatStatus(section);
          const row = (
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
          if (
            (relation.kind === 'addable' || relation.kind === 'conflicting') &&
            seat.kind === 'open'
          ) {
            return (
              <DraggableSection
                key={section.teachTableId}
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
          return <Fragment key={section.teachTableId}>{row}</Fragment>;
        })}
      </div>
    </article>
  );
}

export const CourseCard = memo(CourseCardComponent);
