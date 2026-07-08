// A single placed meeting on the timetable. It shows the subject id, the section,
// the short name, and the room, and clips from the room inward as the column span
// narrows. The fill is the subject's stable color with white text; the KMITL
// orange is never used here. The block is presentational in this phase; the
// remove and drag behavior arrives with the placement system.

import type { CSSProperties } from 'react';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { hashColor } from '@/lib/utils/hash-color';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import type { PlacedSection } from './placedSection';

interface EventBlockProps {
  section: PlacedSection;
  meeting: Meeting;
  style: CSSProperties;
  locale: Locale;
  t: Translate;
  /** Whether this block is blocking the active drag and should pulse. */
  pulsing?: boolean;
}

export function EventBlock({
  section,
  meeting,
  style,
  locale,
  t,
  pulsing = false,
}: EventBlockProps) {
  const name = locale === 'th' ? section.nameTh : section.nameEn;
  const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
  const label = `${section.subjectId} ${name} ${t('section.code')} ${section.section} ${t(dayFullLabelKey(meeting.day))} ${time}`;

  return (
    <div
      data-teach-table-id={section.teachTableId}
      aria-label={label}
      className={`kcp-settle m-px flex min-w-0 flex-col overflow-hidden rounded-kcp px-1.5 py-1 text-[11px] leading-tight text-white ${pulsing ? 'kcp-pulse' : ''}`}
      style={{ ...style, backgroundColor: hashColor(section.subjectId) }}
    >
      <span className="truncate font-semibold">
        {section.subjectId}{' '}
        <span className="font-normal">{section.section}</span>
      </span>
      <span className="truncate">{name}</span>
      {meeting.room !== '' ? (
        <span className="truncate text-white/85">{meeting.room}</span>
      ) : null}
    </div>
  );
}
