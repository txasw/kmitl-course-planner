// The fields of a section comparison, one list for both layouts: the table with a row
// per section and the transposed table with a column per section. Each field reads
// through the formatter the catalog row or the section detail list already uses, so a
// value reads the same in the comparison as on the card: the meeting label and place, the
// localized instructor names, the full seat demand with the host's four counts, the exam
// windows, the condition lines in the warn tone, the curriculum groupings the section is
// open to, and the one status the catalog row would show. A field with nothing to show
// states so in words rather than leaving a blank cell, which a screen reader would read
// as missing data.

import { useMemo, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { OfferedTo, Section } from '@/lib/domain/types';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { pickLocalizedWithLang } from '@/lib/i18n/localize';
import type { ComparisonRow } from '@/lib/catalog/compareSections';
import { conditionLines } from '@/lib/catalog/conditions';
import { computeSeatDemand } from '@/lib/catalog/seatDemand';
import { describeGrouping } from '@/lib/search/describeQuery';
import { examWindowTexts } from '@/features/planner/examText';
import { useReferenceLists } from '@/features/search/useReferenceLists';
import { SeatDemand } from './SeatDemand';
import { StatusBadge } from './StatusBadge';
import { meetingLabel, meetingPlace } from './meetingFormat';

export interface ColumnHead {
  key: TranslationKey;
  /** A quiet second line under the heading, such as the scope of the data. */
  note?: TranslationKey;
  /** The column's minimum width, so a long value wraps instead of squeezing it. */
  width: string;
  /** The edge a column stays pinned to as the table scrolls sideways. */
  pin?: 'left' | 'right';
}

function NoneText({ t }: { t: Translate }) {
  return <span className="text-ink-soft">{t('compare.none')}</span>;
}

function MeetingsCell({ section, t }: { section: Section; t: Translate }) {
  if (section.meetings.length === 0) {
    return <span className="text-ink-soft">{t('detail.noMeetings')}</span>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {section.meetings.map((meeting) => {
        const place = meetingPlace(meeting);
        return (
          <li
            key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
            className="tabular-nums text-ink"
          >
            {meetingLabel(meeting, t)}
            {place !== '' ? (
              <span className="flex items-center gap-1 text-ink-soft">
                <MapPin size={12} aria-hidden className="shrink-0" />
                <span className="min-w-0 break-words">{place}</span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface LinesProps {
  lines: readonly string[];
  lang: Locale;
  className: string;
  t: Translate;
}

function Lines({ lines, lang, className, t }: LinesProps) {
  if (lines.length === 0) {
    return <NoneText t={t} />;
  }
  return (
    <ul lang={lang} className={`flex flex-col gap-0.5 ${className}`}>
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`} className="break-words">
          {line}
        </li>
      ))}
    </ul>
  );
}

function ExamsCell({ section, t }: { section: Section; t: Translate }) {
  const windows = examWindowTexts(section.exam, t);
  const note = (section.exam.note ?? '').trim();
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      {windows.length === 0 ? (
        <span className="text-ink">{t('exam.selfArranged')}</span>
      ) : (
        windows.map((entry) => (
          <span key={entry.kind} className="text-ink-soft">
            <span className="text-ink">{t(`exam.${entry.kind}.short`)}</span>{' '}
            {entry.text}
          </span>
        ))
      )}
      {note !== '' ? (
        <span className="whitespace-pre-line break-words text-ink-soft">
          {note}
        </span>
      ) : null}
    </div>
  );
}

interface OfferedToCellProps {
  offeredTo: readonly OfferedTo[] | undefined;
  locale: Locale;
  t: Translate;
}

// The groupings name themselves through the cached reference lists, as the detail list
// does, so they follow the locale and an id the lists do not hold shows as the raw id.
function OfferedToCell({ offeredTo, locale, t }: OfferedToCellProps) {
  const reference = useReferenceLists();
  const groupings = useMemo(
    () =>
      (offeredTo ?? []).map((grouping) =>
        describeGrouping(grouping, reference, locale, t),
      ),
    [offeredTo, reference, locale, t],
  );
  if (groupings.length === 0) {
    return <NoneText t={t} />;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {groupings.map((grouping, index) => (
        <li
          key={`${String(index)}-${grouping.primary}`}
          className="break-words text-ink"
        >
          {grouping.primary}{' '}
          <span className="text-ink-soft">{grouping.qualifiers.join(' ')}</span>
        </li>
      ))}
    </ul>
  );
}

interface FieldBodyProps {
  row: ComparisonRow;
  locale: Locale;
  t: Translate;
}

export interface ComparisonField extends ColumnHead {
  /** The field's value for one section. */
  Body: (props: FieldBodyProps) => ReactNode;
}

function MeetingsBody({ row, t }: FieldBodyProps) {
  return <MeetingsCell section={row.section} t={t} />;
}

function TeachersBody({ row, locale, t }: FieldBodyProps) {
  const teachers = pickLocalizedWithLang(
    row.section.teachersTh,
    row.section.teachersEn,
    locale,
  );
  return (
    <Lines
      lines={teachers.value}
      lang={teachers.lang}
      className="text-ink"
      t={t}
    />
  );
}

function SeatsBody({ row, t }: FieldBodyProps) {
  return (
    <SeatDemand demand={computeSeatDemand(row.section)} t={t} variant="full" />
  );
}

function ExamsBody({ row, t }: FieldBodyProps) {
  return <ExamsCell section={row.section} t={t} />;
}

function RulesBody({ row, locale, t }: FieldBodyProps) {
  const rules = conditionLines(
    row.section.rulesTh,
    row.section.rulesEn,
    locale,
  );
  return (
    <Lines lines={rules.value} lang={rules.lang} className="text-warn" t={t} />
  );
}

function OfferedToBody({ row, locale, t }: FieldBodyProps) {
  return (
    <OfferedToCell offeredTo={row.section.offeredTo} locale={locale} t={t} />
  );
}

function StatusBody({ row, t }: FieldBodyProps) {
  return row.status === null ? (
    <span className="text-success">{t('compare.addable')}</span>
  ) : (
    <StatusBadge status={row.status} t={t} />
  );
}

/** The compared fields in reading order, between the section and its add action. */
export const COMPARISON_FIELDS: readonly ComparisonField[] = [
  { key: 'compare.col.timePlace', width: 'min-w-[10rem]', Body: MeetingsBody },
  { key: 'detail.teachers', width: 'min-w-[9rem]', Body: TeachersBody },
  { key: 'detail.seats', width: 'min-w-[9rem]', Body: SeatsBody },
  { key: 'compare.col.exams', width: 'min-w-[10rem]', Body: ExamsBody },
  { key: 'section.rules.label', width: 'min-w-[10rem]', Body: RulesBody },
  {
    key: 'offeredTo.label',
    note: 'offeredTo.scope',
    width: 'min-w-[14rem]',
    Body: OfferedToBody,
  },
  { key: 'compare.col.status', width: 'min-w-[7rem]', Body: StatusBody },
];

/** The heading of the field that names each section. */
export const SECTION_HEAD: ColumnHead = {
  key: 'compare.col.section',
  width: 'min-w-[5.5rem]',
};

/** The heading of the add action that closes each section. */
export const ADD_HEAD: ColumnHead = {
  key: 'compare.col.add',
  width: 'min-w-[7rem]',
};

/** A heading's words, with its quiet second line when it has one. */
export function HeadText({ head, t }: { head: ColumnHead; t: Translate }) {
  return (
    <>
      {t(head.key)}
      {head.note === undefined ? null : (
        <span className="block font-normal text-ink-soft">{t(head.note)}</span>
      )}
    </>
  );
}

/** The section code with its lecture or practice kind under it. */
export function SectionHeading({
  section,
  t,
}: {
  section: Section;
  t: Translate;
}) {
  return (
    <>
      <span className="block text-sm font-semibold text-ink tabular-nums">
        {section.section}
      </span>
      <span className="font-normal text-ink-soft">
        {section.kind === 'practice'
          ? t('section.practice')
          : t('section.lecture')}
      </span>
    </>
  );
}
