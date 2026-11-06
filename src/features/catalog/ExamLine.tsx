// The exam line of a section row: the midterm and final dates the section announces, so
// a student sees an exam clash risk before adding rather than only on a blocked add.
// Each window reads through the shared exam formatter the section detail list uses, so
// the row and the popover show one date in the same Buddhist year form. A section that
// announces neither window reads as arranged by the instructor, matching the host, so a
// missing date is never mistaken for an absent line. Each window stays whole and wraps
// to its own line on a narrow row; the registrar's exam detail note, when present, is
// clamped to one line with the full text in a tooltip and in the detail list.

import { CalendarClock } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import type { Exam } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { examWindowTexts } from '@/features/planner/examText';

interface ExamLineProps {
  exam: Exam;
  t: Translate;
}

export function ExamLine({ exam, t }: ExamLineProps) {
  const windows = examWindowTexts(exam, t);
  const note = (exam.note ?? '').trim();

  return (
    <div className="mt-1 flex items-start gap-1 text-ink-soft">
      <CalendarClock size={12} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap gap-x-2 tabular-nums">
          {windows.length === 0 ? (
            <span>{t('exam.selfArranged')}</span>
          ) : (
            windows.map((entry) => (
              <span key={entry.kind} className="whitespace-nowrap">
                <span className="text-ink">
                  {t(`exam.${entry.kind}.short`)}
                </span>{' '}
                {entry.text}
              </span>
            ))
          )}
        </p>
        {note !== '' ? (
          <Tooltip label={note}>
            {(triggerProps, ref) => (
              <p ref={ref} {...triggerProps} className="truncate">
                {note}
              </p>
            )}
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
