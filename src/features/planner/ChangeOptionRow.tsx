// One choice of the change section list (ADR-0068 amendment of 2026-11-22). A student picks
// a section by which group it is, when it meets, where, and who teaches, so the choice shows
// each of those as its own part: the section code as a chip, each meeting as a bold day, a
// time, and a place behind a pin, the seat line, and the instructors. The card is the press
// target through the select button's stretched layer, and it takes the button's hover and
// focus ring (the kcp-choice rules in the shadow sheet), so the instructor line, which
// scrolls rather than selects, never looks pressable. The instructors sit outside the
// button, since a button holds no control of its own (TeacherScroll), and the button names
// their list as its description.

import { Fragment, useId } from 'react';
import { MapPin } from 'lucide-react';
import type { Section } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { fillTemplate } from '@/lib/i18n/template';
import { computeSeatDemand } from '@/lib/catalog/seatDemand';
import { meetingPlace } from '@/features/catalog/meetingFormat';
import { SeatLine } from '@/features/catalog/SeatDemand';
import { TeacherScroll } from './TeacherScroll';

interface ChangeOptionRowProps {
  /** The section and its declared pair, in section code order. */
  group: Section[];
  locale: Locale;
  t: Translate;
  touch: boolean;
  onSelect: (control: HTMLElement) => void;
}

function MemberLine({
  member,
  showKind,
  t,
}: {
  member: Section;
  showKind: boolean;
  t: Translate;
}) {
  // The spaces between the parts are text of their own, which the flex layout drops and
  // the select button's name keeps, so its words stay apart.
  return (
    <span className="flex items-start gap-2">
      <span className="shrink-0 rounded-kcp-inner border border-border bg-surface-alt px-1.5 text-sm font-semibold tabular-nums text-ink">
        <span className="sr-only">{t('section.code')}</span> {member.section}
      </span>{' '}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {showKind ? (
          <span className="text-ink-soft">
            {member.kind === 'practice'
              ? t('section.practice')
              : t('section.lecture')}
          </span>
        ) : null}{' '}
        {member.meetings.length === 0 ? (
          <span className="text-ink-soft">{t('footer.unscheduled')}</span>
        ) : (
          member.meetings.map((meeting) => {
            const place = meetingPlace(meeting);
            return (
              <Fragment
                key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
              >
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold text-ink">
                    {t(dayLabelKey(meeting.day))}
                  </span>{' '}
                  <span className="tabular-nums text-ink">
                    {formatMinutes(meeting.startMin)}-
                    {formatMinutes(meeting.endMin)}
                  </span>
                  {place === '' ? null : (
                    <>
                      {' '}
                      <span className="inline-flex items-center gap-0.5 text-ink-soft">
                        <MapPin size={12} aria-hidden className="shrink-0" />
                        {place}
                      </span>
                    </>
                  )}
                </span>{' '}
              </Fragment>
            );
          })
        )}{' '}
        <SeatLine demand={computeSeatDemand(member)} t={t} as="span" />
      </span>
    </span>
  );
}

export function ChangeOptionRow({
  group,
  locale,
  t,
  touch,
  onSelect,
}: ChangeOptionRowProps) {
  const teachersId = useId();
  const names = [
    ...new Set(
      group.flatMap((member) =>
        locale === 'th' ? member.teachersTh : member.teachersEn,
      ),
    ),
  ];
  return (
    <div
      className={`kcp-choice relative rounded-kcp border border-border bg-surface ${touch ? 'text-sm' : 'text-xs'}`}
    >
      <button
        type="button"
        aria-describedby={names.length > 0 ? teachersId : undefined}
        onClick={(event) => {
          onSelect(event.currentTarget);
        }}
        className="flex w-full flex-col gap-1 rounded-kcp px-2 py-1.5 text-left outline-none after:absolute after:inset-0 after:rounded-kcp after:content-['']"
      >
        {group.map((member) => (
          <Fragment key={member.teachTableId}>
            <MemberLine
              member={member}
              showKind={group.length > 1}
              t={t}
            />{' '}
          </Fragment>
        ))}
      </button>
      {names.length > 0 ? (
        <TeacherScroll
          id={teachersId}
          names={names}
          regionLabel={fillTemplate(t('change.teachersRegion'), {
            section: group.map((member) => member.section).join(', '),
          })}
        />
      ) : null}
    </div>
  );
}
