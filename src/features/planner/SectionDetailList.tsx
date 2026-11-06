// The one list of a section's details, shared by the block hover card and the block
// detail popover so the two surfaces cannot drift apart again. It is a description list
// with a short label column and a value column. The compact density, for the hover card,
// carries the facts a quick look needs: every meeting with its full day, time, and place,
// the kind and credits, the instructors, the seats, and the exam dates. The full density,
// for the popover that touch and keyboard users reach, adds the exam detail, the
// conditions, the remark, and when the section was last checked. Seats read through the
// full SeatDemand variant, the catalog row's seat line plus the host's four counts, from
// the snapshot the latest verification refreshed. A section that announces neither exam
// date reads as arranged by the instructor rather than leaving the exam rows out, so a
// missing date is never mistaken for a missing field. The conditions read in the warn
// tone with the shield icon a catalog row gives them, through the same line split and
// locale fallback, but listed in full since the popover has the room a row does not.

import type { ReactNode } from 'react';
import { MapPin, ShieldAlert } from 'lucide-react';
import type { Section } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { pickLocalizedWithLang } from '@/lib/i18n/localize';
import { conditionLines, textLines } from '@/lib/catalog/conditions';
import { computeSeatDemand } from '@/lib/catalog/seatDemand';
import { SeatDemand } from '@/features/catalog/SeatDemand';
import {
  meetingFullLabel,
  meetingPlace,
} from '@/features/catalog/meetingFormat';
import { examWindowTexts, formatLocalDateTime } from './examText';

export type SectionDetailDensity = 'compact' | 'full';

interface SectionDetailListProps {
  section: Section;
  /** The subject's credit string, for example 3(2-2-5), which the section does not carry. */
  creditStr: string;
  density: SectionDetailDensity;
  locale: Locale;
  t: Translate;
  /** When the latest verification ran, or null before the first. Read in full density. */
  lastVerifiedAt?: string | null;
}

const LABEL_WIDTH: Record<SectionDetailDensity, string> = {
  compact: 'grid-cols-[5rem_minmax(0,1fr)]',
  full: 'grid-cols-[7rem_minmax(0,1fr)]',
};

interface DetailRowProps {
  label: string;
  columns: string;
  /** A leading icon for the label, used by the conditions row. */
  icon?: ReactNode;
  /** The label colour class; ink soft unless the row carries a tone. */
  labelClass?: string;
  children: ReactNode;
}

function DetailRow({
  label,
  columns,
  icon,
  labelClass = 'text-ink-soft',
  children,
}: DetailRowProps) {
  return (
    <div className={`grid ${columns} gap-x-2`}>
      <dt className={`flex items-start gap-1 ${labelClass}`}>
        {icon}
        {label}
      </dt>
      {children}
    </div>
  );
}

const VALUE_BOX = 'col-start-2 min-w-0 break-words';
const VALUE = `${VALUE_BOX} text-ink`;

function checkedAtText(
  lastVerifiedAt: string | null | undefined,
  t: Translate,
): string | null {
  if (lastVerifiedAt === null || lastVerifiedAt === undefined) {
    return null;
  }
  const date = new Date(lastVerifiedAt);
  return Number.isNaN(date.getTime()) ? null : formatLocalDateTime(date, t);
}

export function SectionDetailList({
  section,
  creditStr,
  density,
  locale,
  t,
  lastVerifiedAt = null,
}: SectionDetailListProps) {
  const columns = LABEL_WIDTH[density];
  const full = density === 'full';
  const teachers = pickLocalizedWithLang(
    section.teachersTh,
    section.teachersEn,
    locale,
  );
  const exams = examWindowTexts(section.exam, t);
  const rules = conditionLines(section.rulesTh, section.rulesEn, locale);
  const remarkLines = textLines(section.remark);
  const note = section.exam.note ?? '';
  const checkedAt = checkedAtText(lastVerifiedAt, t);

  return (
    <dl className="flex flex-col gap-1 text-xs">
      <DetailRow label={t('detail.meetings')} columns={columns}>
        {section.meetings.length === 0 ? (
          <dd className={VALUE}>{t('detail.noMeetings')}</dd>
        ) : (
          section.meetings.map((meeting) => {
            const place = meetingPlace(meeting);
            return (
              <dd
                key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
                className={`${VALUE} tabular-nums`}
              >
                {meetingFullLabel(meeting, t)}
                {place !== '' ? (
                  <span className="flex items-center gap-1 text-ink-soft">
                    <MapPin size={12} aria-hidden className="shrink-0" />
                    <span className="min-w-0 break-words">{place}</span>
                  </span>
                ) : null}
              </dd>
            );
          })
        )}
      </DetailRow>

      <DetailRow label={t('detail.kindCredits')} columns={columns}>
        <dd className={VALUE}>
          {section.kind === 'practice'
            ? t('section.practice')
            : t('section.lecture')}{' '}
          <span className="tabular-nums">{creditStr}</span>
        </dd>
      </DetailRow>

      {teachers.value.length > 0 ? (
        <DetailRow label={t('detail.teachers')} columns={columns}>
          {teachers.value.map((name, index) => (
            <dd
              key={`${String(index)}-${name}`}
              lang={teachers.lang}
              className={VALUE}
            >
              {name}
            </dd>
          ))}
        </DetailRow>
      ) : null}

      <DetailRow label={t('detail.seats')} columns={columns}>
        <dd className={VALUE}>
          <SeatDemand
            demand={computeSeatDemand(section)}
            t={t}
            variant="full"
          />
        </dd>
      </DetailRow>

      {exams.length === 0 ? (
        <DetailRow label={t('detail.exams')} columns={columns}>
          <dd className={VALUE}>{t('exam.selfArranged')}</dd>
        </DetailRow>
      ) : (
        exams.map((exam) => (
          <DetailRow
            key={exam.kind}
            label={t(`exam.${exam.kind}`)}
            columns={columns}
          >
            <dd className={`${VALUE} tabular-nums`}>{exam.text}</dd>
          </DetailRow>
        ))
      )}

      {full && note !== '' ? (
        <DetailRow label={t('detail.examDetail')} columns={columns}>
          <dd className={`${VALUE} whitespace-pre-line`}>{note}</dd>
        </DetailRow>
      ) : null}

      {full && rules.value.length > 0 ? (
        <DetailRow
          label={t('section.rules.label')}
          columns={columns}
          icon={
            <ShieldAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
          }
          labelClass="text-warn"
        >
          {rules.value.map((line, index) => (
            <dd
              key={`${String(index)}-${line}`}
              lang={rules.lang}
              className={`${VALUE_BOX} text-warn`}
            >
              {line}
            </dd>
          ))}
        </DetailRow>
      ) : null}

      {full && remarkLines.length > 0 ? (
        <DetailRow label={t('section.remark.label')} columns={columns}>
          {remarkLines.map((line, index) => (
            <dd key={`${String(index)}-${line}`} className={VALUE}>
              {line}
            </dd>
          ))}
        </DetailRow>
      ) : null}

      {full && checkedAt !== null ? (
        <DetailRow label={t('detail.verifiedAt')} columns={columns}>
          <dd className={`${VALUE} tabular-nums`}>{checkedAt}</dd>
        </DetailRow>
      ) : null}
    </dl>
  );
}
