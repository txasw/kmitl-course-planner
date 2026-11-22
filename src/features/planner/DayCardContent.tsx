// The content of a placed block in the phone day view, the day card of the redesign (ADR-0047
// amendment of 2026-11-21). The day view gives a block the full width of the pane and a height
// of about 70 px an hour, so the positioned block's compact reading order, laid out for a
// narrow week column, crowded the top of a tall card and left the rest of it empty. The day
// card reads top to bottom instead: the time range as a clear first line, since a single day
// column leaves the student to read the minutes off a distant axis, then the name in the panel
// language and the other language's name under it, then the place with its location glyph,
// and at the foot of the card the section and the lecture or practice kind as chips, with the
// subject id at the end of the same line. The foot sits at the bottom of the card, so a long
// meeting reads as one card from its first line to its last rather than a cluster at its top.
//
// The card walks the density ladder of every block (ADR-0046) in the day card order: a short
// meeting drops the subject id first, then the other language's name, then clamps the name,
// then the chips, then reduces the name to one line, then the place, and the time it leads with
// last, with the name never dropping. The time and the subject id are whole fields that show in
// full or drop whole, so a card never cuts a time or a code.

import type { RefObject } from 'react';
import { MapPin } from 'lucide-react';
import type { MeetingKind } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { DensityLevel } from '@/lib/planner/blockDensity';
import type { BlockBadge } from './blockBadge';
import { CHIP_CLASS, contentEndPadding } from './blockSurface';
import { NAME_CLAMP, WHOLE_FIELD, nameClampStyle, nameLine } from './blockText';

interface DayCardContentProps {
  contentRef: RefObject<HTMLDivElement | null>;
  level: DensityLevel;
  name: string;
  nameLang: Locale;
  secondary: string | null;
  secondaryLang: Locale | null;
  place: string;
  /** The place is the no room placeholder, which reads quiet in its usual slot. */
  roomless: boolean;
  sectionCode: string;
  kind: MeetingKind;
  time: string;
  subjectId: string;
  /** The abbreviated forms of the name, least shortened first. */
  abbreviations: readonly string[];
  color: string;
  badge: BlockBadge | null;
  /** Keep the first line clear of the remove control that shows in the top right corner on
   * hover and focus under a fine pointer. */
  reserveRemove: boolean;
  t: Translate;
}

const REMOVE_CLEARANCE = 'not-pointer-coarse:pr-6';

export function DayCardContent({
  contentRef,
  level,
  name,
  nameLang,
  secondary,
  secondaryLang,
  place,
  roomless,
  sectionCode,
  kind,
  time,
  subjectId,
  abbreviations,
  color,
  badge,
  reserveRemove,
  t,
}: DayCardContentProps) {
  const line = nameLine(level, name, nameLang, abbreviations);
  const chip = `shrink-0 rounded-kcp-inner px-1.5 ${CHIP_CLASS} text-ink-soft`;
  const clearance = reserveRemove ? REMOVE_CLEARANCE : '';
  const dot =
    badge === null ? null : (
      <span
        aria-hidden
        className={`mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle ${
          badge === 'danger' ? 'bg-danger' : 'bg-warn'
        }`}
      />
    );
  const showFoot = level.showSection || level.showId;
  return (
    <div
      ref={contentRef}
      data-fit
      data-day-card
      className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden ${contentEndPadding(true)}`}
    >
      {level.showTime ? (
        <span
          data-fit-whole="time"
          className={`${WHOLE_FIELD} shrink-0 text-[1.1em] font-semibold tabular-nums ${clearance}`}
        >
          {dot}
          {time}
        </span>
      ) : null}
      <span
        data-fit-name
        data-name-form={level.nameForm}
        lang={line.lang}
        className={`shrink-0 text-[1.2em] font-semibold ${line.className} ${
          level.nameLines === 'all' ? '' : NAME_CLAMP
        } ${level.showTime ? '' : clearance}`}
        style={nameClampStyle(level.nameLines)}
      >
        {level.showTime ? null : dot}
        {line.text}
      </span>
      {level.showSecondary && secondary !== null ? (
        <span
          data-fit-whole="secondary"
          lang={secondaryLang ?? undefined}
          className={`shrink-0 overflow-hidden break-normal text-ink-soft`}
        >
          {secondary}
        </span>
      ) : null}
      {level.showPlace ? (
        <span
          className={`mt-0.5 shrink-0 break-words ${roomless ? 'text-ink-soft' : 'text-ink'}`}
        >
          <MapPin
            size="0.95em"
            strokeWidth={2}
            aria-hidden
            className="mr-1 inline-block align-[-0.1em]"
            style={roomless ? undefined : { color }}
          />
          {place}
        </span>
      ) : null}
      {showFoot ? (
        <div className="mt-auto flex shrink-0 flex-wrap items-center gap-1.5 pt-1 text-[0.95em]">
          {level.showSection ? (
            <>
              <span className={`${chip} tabular-nums`}>
                {t('section.code')} {sectionCode}
              </span>
              <span className={chip}>
                {t(kind === 'lecture' ? 'section.lecture' : 'section.practice')}
              </span>
            </>
          ) : null}
          {level.showId ? (
            <span
              data-fit-whole="id"
              className={`${WHOLE_FIELD} ml-auto tabular-nums text-ink-soft`}
            >
              {subjectId}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
