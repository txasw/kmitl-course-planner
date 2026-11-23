// One section group as the registration helper lists it: each section's code and kind,
// every meeting day and time with its place, and the exam windows. A lecture and its
// practice pair read as one group, so the student sees both halves the page will ask for.

import { Pill } from '@/components/Pill';
import type { SectionSnapshot } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { meetingLabel, meetingPlace } from '@/features/catalog/meetingFormat';
import { examWindowTexts } from '@/features/planner/examText';

interface SectionLinesProps {
  sections: readonly SectionSnapshot[];
  t: Translate;
}

export function SectionLines({ sections, t }: SectionLinesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {sections.map((section) => (
        <div key={section.teachTableId} className="flex flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">
              {fillTemplate(t('regis.section'), { code: section.section })}
            </span>
            <Pill tone="neutral">
              {t(
                section.kind === 'lecture'
                  ? 'section.lecture'
                  : 'section.practice',
              )}
            </Pill>
          </p>
          {section.meetings.length === 0 ? (
            <p className="text-ink-soft">{t('regis.noMeeting')}</p>
          ) : (
            <ul className="flex flex-col">
              {section.meetings.map((meeting) => (
                <li
                  key={`${String(meeting.day)}-${String(meeting.startMin)}`}
                  className="flex flex-wrap gap-x-2"
                >
                  <span className="tabular-nums">
                    {meetingLabel(meeting, t)}
                  </span>
                  <span className="text-ink-soft">{meetingPlace(meeting)}</span>
                </li>
              ))}
            </ul>
          )}
          {examWindowTexts(section.exam, t).map((exam) => (
            <p key={exam.kind} className="text-ink-soft">
              {t(exam.kind === 'midterm' ? 'exam.midterm' : 'exam.final')}{' '}
              {exam.text}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
