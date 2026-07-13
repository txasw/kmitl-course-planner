// A single placed meeting on the timetable, one component across edit, preview, and
// export. Its hierarchy leads with the time range, then the subject name clamped to
// two lines, then the subject id, a section chip, and the place (building and room).
// The fill is a soft tint of the subject's stable color under ink text with the solid
// color as a left bar (ADR-0035); the KMITL orange is never used here. It clips from
// the foot inward as the block shortens, so the subject name never disappears while a
// lower priority field remains: the time and at least one clamped line of the name are
// pinned (shrink-0), and the foot, the subject id, the chip, and the place, is the only
// part that yields, since the id is recoverable from the text export and the chip
// carries the section (ADR-0040). In edit mode the block is a drag source (the
// ref and listeners come from the draggable wrapper so this stays free of the drag
// library) and carries a focusable remove control, which keeps on grid removal
// reachable by keyboard.

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
  /** Whether this block's exam window overlaps another placed entry's, a discovered
   * conflict that reads danger. */
  examConflicted?: boolean;
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
  examConflicted = false,
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
  const badge = blockBadge(section.verifyStatus, conflicted, examConflicted);
  const badgeText = blockBadgeLabelKeys(
    section.verifyStatus,
    conflicted,
    examConflicted,
  )
    .map((key) => t(key))
    .join(' ');
  // Room and building read together as the place. Both can be empty on an online
  // course, so the middot separator only appears when both are present.
  const place = [meeting.building, meeting.room]
    .filter((part) => part !== '')
    .join(' · ');
  // The accessible name is self contained so a screen reader hears the whole meeting
  // from the block alone: subject, name, section, full day, time, the place when it is
  // shown, then any verification state. The place follows the visual toggle so the
  // label matches what is on screen.
  const placeText = showRoom && place !== '' ? ` ${place}` : '';
  const label = `${section.subjectId} ${name} ${t('section.code')} ${section.section} ${t(dayFullLabelKey(meeting.day))} ${time}${placeText}${
    badgeText === '' ? '' : ` ${badgeText}`
  }`;

  return (
    <div
      ref={dragRef}
      data-teach-table-id={section.teachTableId}
      data-verify={badge ?? undefined}
      aria-label={label}
      onContextMenu={onContextMenu}
      className={`group/block kcp-settle relative m-px flex min-w-0 flex-col overflow-hidden rounded-kcp py-1 pr-1.5 pl-2.5 text-[1em] leading-tight text-ink ${pulsing ? 'kcp-pulse' : ''} ${dimmed ? 'opacity-40' : ''} ${dragListeners ? 'cursor-grab touch-none' : ''} ${badge === 'danger' ? 'ring-2 ring-danger ring-inset' : ''}`}
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
      {/* Emphasis order time, place, subject: the time range leads, the subject name
          is the primary content clamped to two lines, and the subject id, the section
          chip, and the place read as quieter meta at the foot of the block. The time
          and the name are pinned with shrink-0 so a short block clips the foot first
          rather than squeezing the name out; the name keeps at least one clamped line. */}
      <span className="shrink-0 font-semibold">{time}</span>
      <span className="line-clamp-2 shrink-0 font-medium">{name}</span>
      {englishSecondary ? (
        <span className="line-clamp-1 shrink-0 text-ink-soft">
          {section.nameEn}
        </span>
      ) : null}
      <div className="mt-auto min-h-0 pt-0.5">
        <div className="flex items-center justify-between gap-1 text-ink-soft">
          <span className="truncate">{section.subjectId}</span>
          {showSection ? (
            <span className="shrink-0 rounded bg-ink/10 px-1 text-[0.9em] font-medium text-ink">
              {section.section}
            </span>
          ) : null}
        </div>
        {showRoom && place !== '' ? (
          <span className="block truncate text-ink-soft">{place}</span>
        ) : null}
      </div>
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
// draggable wrapper. The pulsing, dimmed, conflicted, and exam conflicted flags are the
// only props that vary mid drag, so only the affected blocks re-render.
export const EventBlock = memo(EventBlockComponent);
