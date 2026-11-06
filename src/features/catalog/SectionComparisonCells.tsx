// The cells of one section comparison row. Each column reads through the formatter the
// catalog row or the section detail list already uses, so a value reads the same in the
// table as on the card: the meeting label and place, the localized instructor names, the
// full seat demand with the host's four counts, the exam windows, the condition lines in
// the warn tone, and the curriculum groupings the section is open to. A column with
// nothing to show states so in words rather than leaving a blank cell, which a screen
// reader would read as missing data. The section cell is the row header and stays in
// view as the table scrolls sideways, on the row's own zebra surface so the rows that
// pass under it never show through.

import { useMemo } from 'react';
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

interface ColumnHead {
  key: TranslationKey;
  /** A quiet second line under the heading, such as the scope of the data. */
  note?: TranslationKey;
  /** The column's minimum width, so a long value wraps instead of squeezing it. */
  width: string;
}

export const COLUMN_HEADS: readonly ColumnHead[] = [
  { key: 'compare.col.section', width: 'min-w-[5.5rem]' },
  { key: 'compare.col.timePlace', width: 'min-w-[10rem]' },
  { key: 'detail.teachers', width: 'min-w-[9rem]' },
  { key: 'detail.seats', width: 'min-w-[9rem]' },
  { key: 'compare.col.exams', width: 'min-w-[10rem]' },
  { key: 'section.rules.label', width: 'min-w-[10rem]' },
  { key: 'offeredTo.label', note: 'offeredTo.scope', width: 'min-w-[14rem]' },
  { key: 'compare.col.status', width: 'min-w-[7rem]' },
];

export const HEAD_CELL =
  'sticky top-0 border-b border-border bg-surface-alt px-2 py-1.5 text-left align-bottom font-semibold text-ink';

const CELL = 'border-b border-border px-2 py-1.5 text-left align-top';

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

interface ComparisonCellsProps {
  row: ComparisonRow;
  /** Whether the row takes the alternate surface. */
  zebra: boolean;
  locale: Locale;
  t: Translate;
}

export function ComparisonCells({
  row,
  zebra,
  locale,
  t,
}: ComparisonCellsProps) {
  const { section, status } = row;
  const surface = zebra ? 'bg-surface-alt' : 'bg-surface';
  const teachers = pickLocalizedWithLang(
    section.teachersTh,
    section.teachersEn,
    locale,
  );
  const rules = conditionLines(section.rulesTh, section.rulesEn, locale);
  return (
    <>
      <th
        scope="row"
        className={`${CELL} ${surface} sticky left-0 z-[1] font-normal`}
      >
        <span className="block text-sm font-semibold text-ink tabular-nums">
          {section.section}
        </span>
        <span className="text-ink-soft">
          {section.kind === 'practice'
            ? t('section.practice')
            : t('section.lecture')}
        </span>
      </th>
      <td className={`${CELL} ${surface}`}>
        <MeetingsCell section={section} t={t} />
      </td>
      <td className={`${CELL} ${surface}`}>
        <Lines
          lines={teachers.value}
          lang={teachers.lang}
          className="text-ink"
          t={t}
        />
      </td>
      <td className={`${CELL} ${surface}`}>
        <SeatDemand demand={computeSeatDemand(section)} t={t} variant="full" />
      </td>
      <td className={`${CELL} ${surface}`}>
        <ExamsCell section={section} t={t} />
      </td>
      <td className={`${CELL} ${surface}`}>
        <Lines
          lines={rules.value}
          lang={rules.lang}
          className="text-warn"
          t={t}
        />
      </td>
      <td className={`${CELL} ${surface}`}>
        <OfferedToCell offeredTo={section.offeredTo} locale={locale} t={t} />
      </td>
      <td className={`${CELL} ${surface}`}>
        {status === null ? (
          <span className="text-success">{t('compare.addable')}</span>
        ) : (
          <StatusBadge status={status} t={t} />
        )}
      </td>
    </>
  );
}
