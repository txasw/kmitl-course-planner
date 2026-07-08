// A course card: the subject id, the locale primary name with the other language
// as secondary text, the credit string, and one row per section. Each section's
// seat status and plan relation are computed here from the placed sections.

import { Fragment } from 'react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import { computeSectionRelation } from '@/lib/planner/sectionState';
import { DraggableSection } from './DraggableSection';
import { SectionRow } from './SectionRow';

interface CourseCardProps {
  course: Course;
  placed: Section[];
  locale: Locale;
  t: Translate;
  onAdd?: ((course: Course, section: Section) => void) | undefined;
  onRemove?: ((teachTableId: string) => void) | undefined;
}

export function CourseCard({
  course,
  placed,
  locale,
  t,
  onAdd,
  onRemove,
}: CourseCardProps) {
  const primary = locale === 'th' ? course.nameTh : course.nameEn;
  const secondary = locale === 'th' ? course.nameEn : course.nameTh;

  return (
    <article className="rounded-kcp border border-border p-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold text-ink">{course.subjectId}</span>{' '}
          <span className="text-ink">{primary}</span>
          {secondary !== '' && secondary !== primary ? (
            <span className="ml-1 text-ink-soft">{secondary}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-ink-soft">
          {course.creditStr}
        </span>
      </header>
      <div className="mt-2 flex flex-col gap-1.5">
        {course.sections.map((section) => {
          const relation = computeSectionRelation(placed, course, section);
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
