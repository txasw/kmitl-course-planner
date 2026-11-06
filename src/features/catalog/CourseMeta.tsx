// The second line of a course card's toggle, read as the button's description. An
// unadded card summarizes its course: the section count, the days it meets, and one
// fit status. The short day labels are hidden from assistive technology, which reads
// the full day names as one sentence instead. Every status is text, so colour and the
// icon only reinforce it. An added card names the section the plan holds instead.

import { AlertTriangle, Check } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import type { Section } from '@/lib/domain/types';
import type { CourseFit, CourseSummary } from '@/lib/catalog/courseSummary';
import { StatusBadge } from './StatusBadge';
import { meetingLabel } from './meetingFormat';

const META =
  'flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-ink-soft';

function FitStatus({ fit, t }: { fit: CourseFit; t: Translate }) {
  switch (fit.kind) {
    case 'crossTerm':
      return <StatusBadge status="different_term" t={t} />;
    case 'addable':
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <Check size={12} strokeWidth={2} aria-hidden />
          {fillTemplate(t('catalog.card.addable'), { n: fit.count })}
        </span>
      );
    case 'allConflict':
      return (
        <span className="inline-flex items-center gap-1 text-danger">
          <AlertTriangle size={12} strokeWidth={2} aria-hidden />
          {t('catalog.card.allConflict')}
        </span>
      );
    case 'allUnavailable':
      return <span>{t('catalog.card.allUnavailable')}</span>;
    case 'noneAddable':
      return (
        <span className="text-danger">{t('catalog.card.noneAddable')}</span>
      );
  }
}

interface FitLineProps {
  id: string;
  summary: CourseSummary;
  t: Translate;
}

export function FitLine({ id, summary, t }: FitLineProps) {
  const count =
    summary.sectionCount === 1
      ? t('catalog.card.sectionCountOne')
      : fillTemplate(t('catalog.card.sectionCount'), {
          n: summary.sectionCount,
        });
  return (
    <span id={id} data-course-meta className={META}>
      <span>{count}</span>
      {summary.scheduled ? (
        <>
          <span aria-hidden>
            {summary.days.map((day) => t(dayLabelKey(day))).join(' ')}
          </span>
          <span className="sr-only">
            {fillTemplate(t('catalog.card.meetsOn'), { days: summary.dayList })}
          </span>
        </>
      ) : (
        <span>{t('catalog.card.noMeeting')}</span>
      )}
      <FitStatus fit={summary.fit} t={t} />
    </span>
  );
}

interface AddedLineProps {
  id: string;
  /** The placed section of the course, as the plan holds it. */
  section: Section;
  t: Translate;
}

export function AddedLine({ id, section, t }: AddedLineProps) {
  const first = section.meetings[0];
  return (
    <span id={id} data-course-meta className={META}>
      <StatusBadge status="added" t={t} />
      <span>
        {t('section.code')} {section.section}
      </span>
      <span>
        {first === undefined
          ? t('catalog.card.noMeeting')
          : meetingLabel(first, t)}
      </span>
    </span>
  );
}
