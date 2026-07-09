// A single placed meeting on the timetable. It shows the subject id, the section,
// the short name, and the room, and clips from the room inward as the column span
// narrows. The fill is the subject's stable color with white text; the KMITL orange
// is never used here. In edit mode the block is a drag source (the ref and listeners
// come from the draggable wrapper so this stays free of the drag library) and carries
// a focusable remove control, which keeps on grid removal reachable by keyboard.

import type { CSSProperties } from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { X } from 'lucide-react';
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
  /** Whether this block is being moved and should read at low emphasis. */
  dimmed?: boolean;
  /** The draggable node ref, present only for an edit mode drag source. */
  dragRef?: (element: HTMLElement | null) => void;
  /** The pointer drag listeners, present only for an edit mode drag source. */
  dragListeners?: DraggableSyntheticListeners;
  /** Remove this section from the plan, present only in edit mode. */
  onRemove?: () => void;
  removeLabel?: string;
}

export function EventBlock({
  section,
  meeting,
  style,
  locale,
  t,
  pulsing = false,
  dimmed = false,
  dragRef,
  dragListeners,
  onRemove,
  removeLabel,
}: EventBlockProps) {
  const name = locale === 'th' ? section.nameTh : section.nameEn;
  const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
  const label = `${section.subjectId} ${name} ${t('section.code')} ${section.section} ${t(dayFullLabelKey(meeting.day))} ${time}`;

  return (
    <div
      ref={dragRef}
      data-teach-table-id={section.teachTableId}
      aria-label={label}
      className={`group/block kcp-settle relative m-px flex min-w-0 flex-col overflow-hidden rounded-kcp px-1.5 py-1 text-[11px] leading-tight text-white ${pulsing ? 'kcp-pulse' : ''} ${dimmed ? 'opacity-40' : ''} ${dragListeners ? 'cursor-grab touch-none' : ''}`}
      style={{ ...style, backgroundColor: hashColor(section.subjectId) }}
      {...dragListeners}
    >
      <span className="truncate font-semibold">
        {section.subjectId}{' '}
        <span className="font-normal">{section.section}</span>
      </span>
      <span className="truncate">{name}</span>
      {meeting.room !== '' ? (
        <span className="truncate text-white/85">{meeting.room}</span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onPointerDown={(event) => {
            // Keep a press on the control from arming a drag on the block behind it.
            event.stopPropagation();
          }}
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 rounded bg-black/25 p-0.5 text-white opacity-0 outline-none group-hover/block:opacity-100 hover:bg-black/45 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
