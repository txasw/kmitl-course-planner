// One choice of the change section list (ADR-0068 amendment of 2026-11-22). A student picks
// a section by which group it is, when it meets, where, and who teaches, so the choice shows
// each of those as its own part: the section code as a chip, each meeting as a bold day, a
// time, and a place behind a pin, the seat line, and the instructors. The card is the press
// target through the select button's stretched layer. The instructors sit outside the
// button, since a button holds no control of its own: their line is one row that scrolls
// sideways, ending in a fade and an ellipsis while names lie past its edge, and is a tab stop
// then, so a keyboard scrolls it too; the select button names the list as its description.
// This line is the owner approved exception to the no ellipsis rule (ADR-0048 amendment of
// 2026-11-22).

import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react';
import { MapPin, UserRound } from 'lucide-react';
import type { Section } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { computeSeatDemand, seatLineText } from '@/lib/catalog/seatDemand';
import { FOCUS_RING } from '@/lib/ui/focus';
import { meetingPlace } from '@/features/catalog/meetingFormat';

interface ChangeOptionRowProps {
  /** The section and its declared pair, in section code order. */
  group: Section[];
  locale: Locale;
  t: Translate;
  touch: boolean;
  onSelect: (control: HTMLElement) => void;
}

// The card takes the focus ring of its select button, so the ring circles the whole choice
// the button's stretched layer makes pressable.
const CARD =
  'relative rounded-kcp border border-border bg-surface hover:border-ink-soft has-[>button:focus-visible]:ring-(length:--kcp-focus-width) has-[>button:focus-visible]:ring-inset has-[>button:focus-visible]:ring-(color:--kcp-focus-color)';

function MemberLine({
  member,
  showKind,
  t,
}: {
  member: Section;
  showKind: boolean;
  t: Translate;
}) {
  const demand = computeSeatDemand(member);
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
                key={`${String(meeting.day)}-${String(meeting.startMin)}`}
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
        <span
          className={demand.state === 'open' ? 'text-success' : 'text-ink-soft'}
        >
          {seatLineText(demand, t)}
        </span>
      </span>
    </span>
  );
}

// While names lie past the end of the line, a fade and an ellipsis close its text row, above
// the scrollbar a mouse sees. Neither takes a press, so the line scrolls under them, and a
// keyboard focus on the line drops them so its ring shows whole.
const MORE =
  "after:pointer-events-none after:absolute after:top-0 after:right-2 after:flex after:h-[1lh] after:w-10 after:items-center after:justify-end after:bg-linear-to-r after:from-transparent after:to-surface after:to-60% after:content-['…'] has-focus-visible:after:hidden";

interface Fit {
  /** The line holds more than it shows. */
  wide: boolean;
  /** Names still lie past the end of the line. */
  more: boolean;
}

function readFit(node: HTMLElement, previous: Fit): Fit {
  const wide = node.scrollWidth > node.clientWidth + 1;
  const more = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
  return previous.wide === wide && previous.more === more
    ? previous
    : { wide, more };
}

function TeacherScroll({
  id,
  names,
  t,
}: {
  id: string;
  names: string[];
  t: Translate;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const label = t('section.teachers.label');
  const [fit, setFit] = useState<Fit>({ wide: false, more: false });
  const key = names.join(', ');
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    // An observer reports once as it starts, so a new list is measured as well.
    const observer = new ResizeObserver(() => {
      setFit((previous) => readFit(node, previous));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [key]);
  return (
    <div
      className={`relative flex items-center gap-1 px-2 pb-1.5 text-ink-soft ${fit.more ? MORE : ''}`}
    >
      <UserRound size={12} aria-hidden className="shrink-0" />
      {/* Only a line that holds more than it shows is a named region and a tab stop, the
          scrollable region pattern, so a keyboard can scroll it with the arrow keys. */}
      <div
        ref={ref}
        data-teacher-scroll
        role={fit.wide ? 'region' : undefined}
        aria-label={fit.wide ? label : undefined}
        tabIndex={fit.wide ? 0 : undefined}
        onScroll={(event) => {
          const node = event.currentTarget;
          setFit((previous) => readFit(node, previous));
        }}
        className={`kcp-scroll min-w-0 flex-1 overflow-x-auto rounded-kcp-inner ${FOCUS_RING}`}
      >
        <ul id={id} aria-label={label} className="flex gap-1 whitespace-nowrap">
          {names.map((name, index) => (
            <li key={name}>
              {name}
              {index < names.length - 1 ? ',' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
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
    <div className={`${CARD} ${touch ? 'text-sm' : 'text-xs'}`}>
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
        <TeacherScroll id={teachersId} names={names} t={t} />
      ) : null}
    </div>
  );
}
