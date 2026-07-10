// A course card: the subject id, the locale primary name with the other language
// as secondary text, the credit string, and one row per section. Each section's
// seat status and plan relation are computed here from the placed sections.

import { Fragment, memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
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

// The whole course is a pointer drag source through this grip. It previews every
// section as a candidate slot on the grid. It carries no keyboard handler on
// purpose: keyboard users add a specific section through the per section add
// buttons, which reach the same sections, so this grip stays out of the tab order.
function CourseDragHandle({
  course,
  label,
}: {
  course: Course;
  label: string;
}) {
  const { setNodeRef, listeners } = useDraggable({
    id: `course-${course.subjectId}`,
    data: { course },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      aria-hidden
      title={label}
      className="flex shrink-0 cursor-grab touch-none items-center self-center rounded-kcp px-0.5 text-ink-soft hover:text-ink"
    >
      <GripVertical size={14} strokeWidth={2} />
    </div>
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
  // overflowing the card, and the full text rides on the title for a hover.
  const fullName = hasSecondary
    ? `${course.subjectId} ${primary} ${secondary}`
    : `${course.subjectId} ${primary}`;
  // A cross term course cannot be added, so its whole course drag grip is hidden;
  // its rows carry the different term state and a switch action instead.
  const crossTerm = isCrossTerm(term);

  return (
    <article className="rounded-kcp border border-border p-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1">
          {onAdd !== undefined && !crossTerm ? (
            <CourseDragHandle
              course={course}
              label={`${t('action.dragCourse')} ${course.subjectId}`}
            />
          ) : null}
          <div className="min-w-0 truncate" title={fullName}>
            <span className="font-semibold text-ink">{course.subjectId}</span>{' '}
            <span className="text-ink">{primary}</span>
            {hasSecondary ? (
              <span className="ml-1 text-ink-soft">{secondary}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-ink-soft">
          {course.creditStr}
        </span>
      </header>
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
