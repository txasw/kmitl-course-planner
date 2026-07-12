// A single placed meeting on the timetable. It shows the subject id, the section,
// the short name, and the room, and clips from the room inward as the column span
// narrows. The fill is the subject's stable color with white text; the KMITL orange
// is never used here. In edit mode the block is a drag source (the ref and listeners
// come from the draggable wrapper so this stays free of the drag library) and carries
// a focusable remove control, which keeps on grid removal reachable by keyboard.

import { memo, type CSSProperties, type MouseEvent } from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { Info, X } from 'lucide-react';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { hashColor, hashTint } from '@/lib/utils/hash-color';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import type { PlacedSection } from './placedSection';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';

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
  /** Whether a revalidation time change put this block into a new conflict. */
  conflicted?: boolean;
  /** Whether this block's exam window overlaps another entry's, a warning not a block. */
  examWarned?: boolean;
  /** The draggable node ref, present only for an edit mode drag source. */
  dragRef?: (element: HTMLElement | null) => void;
  /** The pointer drag listeners, present only for an edit mode drag source. */
  dragListeners?: DraggableSyntheticListeners;
  /** Remove this section from the plan by its id, present only in edit mode. The
   * block passes its own id so the grid can hand down one stable handler rather than
   * a fresh per block closure, which keeps this memoized block from re-rendering. */
  onRemove?: (teachTableId: string) => void;
  removeLabel?: string;
  /** Open the block detail popover anchored to this block, edit mode only. */
  onOpenDetail?: (anchor: HTMLElement) => void;
  /** Open the block context menu at the pointer on a right click, edit mode only. */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Show the room line. A preview display option; on by default in edit mode. */
  showRoom?: boolean;
  /** Show the section code beside the subject id. On by default in edit mode. */
  showSection?: boolean;
  /** Add the English name as a secondary line under a Thai primary name. */
  showEnglishName?: boolean;
}

function EventBlockComponent({
  section,
  meeting,
  style,
  locale,
  t,
  pulsing = false,
  dimmed = false,
  conflicted = false,
  examWarned = false,
  dragRef,
  dragListeners,
  onRemove,
  removeLabel,
  onOpenDetail,
  onContextMenu,
  showRoom = true,
  showSection = true,
  showEnglishName = false,
}: EventBlockProps) {
  const name = locale === 'th' ? section.nameTh : section.nameEn;
  // The English name is guaranteed visible when the option is on: it is the primary
  // in English, so it only needs adding as a secondary line under a Thai primary.
  const englishSecondary =
    showEnglishName && locale === 'th' && section.nameEn !== '';
  const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
  const badge = blockBadge(section.verifyStatus, conflicted, examWarned);
  const badgeText = blockBadgeLabelKeys(
    section.verifyStatus,
    conflicted,
    examWarned,
  )
    .map((key) => t(key))
    .join(' ');
  // The accessible name is self contained so a screen reader hears the whole meeting
  // from the block alone: subject, name, section, full day, time, the room when it is
  // shown, then any verification state. The room follows the visual toggle so the label
  // matches what is on screen.
  const roomText = showRoom && meeting.room !== '' ? ` ${meeting.room}` : '';
  const label = `${section.subjectId} ${name} ${t('section.code')} ${section.section} ${t(dayFullLabelKey(meeting.day))} ${time}${roomText}${
    badgeText === '' ? '' : ` ${badgeText}`
  }`;

  return (
    <div
      ref={dragRef}
      data-teach-table-id={section.teachTableId}
      data-verify={badge ?? undefined}
      aria-label={label}
      onContextMenu={onContextMenu}
      className={`group/block kcp-settle relative m-px flex min-w-0 flex-col overflow-hidden rounded-kcp py-1 pr-1.5 pl-2.5 text-[11px] leading-tight text-ink ${pulsing ? 'kcp-pulse' : ''} ${dimmed ? 'opacity-40' : ''} ${dragListeners ? 'cursor-grab touch-none' : ''} ${badge === 'danger' ? 'ring-2 ring-danger ring-inset' : ''}`}
      style={{ ...style, backgroundColor: hashTint(section.subjectId) }}
      {...dragListeners}
    >
      {/* The solid subject color as a left bar carries the identity; the fill is a soft
          tint of it under ink text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: hashColor(section.subjectId) }}
      />
      {badge === 'danger' ? (
        <span
          aria-hidden
          className="kcp-hatch pointer-events-none absolute inset-0 rounded-kcp"
        />
      ) : null}
      {badge !== null ? (
        <span
          aria-hidden
          className={`absolute left-0.5 top-0.5 h-2 w-2 rounded-full ring-1 ring-white ${
            badge === 'danger' ? 'bg-danger' : 'bg-warn'
          }`}
        />
      ) : null}
      <span className="truncate font-semibold">
        {section.subjectId}
        {showSection ? (
          <>
            {' '}
            <span className="font-normal">{section.section}</span>
          </>
        ) : null}
      </span>
      <span className="truncate">{name}</span>
      {englishSecondary ? (
        <span className="truncate text-ink-soft">{section.nameEn}</span>
      ) : null}
      {showRoom && meeting.room !== '' ? (
        <span className="truncate text-ink-soft">{meeting.room}</span>
      ) : null}
      {onOpenDetail !== undefined || onRemove !== undefined ? (
        <div className="absolute right-0.5 top-0.5 flex gap-0.5">
          {onOpenDetail !== undefined ? (
            <button
              type="button"
              aria-label={t('block.details')}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                const block = event.currentTarget.closest(
                  '[data-teach-table-id]',
                );
                if (block instanceof HTMLElement) {
                  onOpenDetail(block);
                }
              }}
              className="rounded bg-ink/5 p-0.5 text-ink-soft opacity-0 outline-none group-hover/block:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <Info size={12} aria-hidden />
            </button>
          ) : null}
          {onRemove !== undefined ? (
            <button
              type="button"
              aria-label={removeLabel}
              onPointerDown={(event) => {
                // Keep a press on the control from arming a drag on the block behind it.
                event.stopPropagation();
              }}
              onClick={() => {
                onRemove(section.teachTableId);
              }}
              className="rounded bg-ink/5 p-0.5 text-ink-soft opacity-0 outline-none group-hover/block:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Memoized so a grid re-render (a drag hover, a revalidation, a plan change) only
// re-renders the blocks whose own props changed. The grid stabilizes every prop it
// passes: the style object is built inside the memoized block list, the remove
// handler is one id taking callback, and the drag ref and listeners come from the
// draggable wrapper. The pulsing, dimmed, conflicted, and exam warned flags are the
// only props that vary mid drag, so only the affected blocks re-render.
export const EventBlock = memo(EventBlockComponent);
