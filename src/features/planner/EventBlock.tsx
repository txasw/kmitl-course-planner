// A single placed meeting on the timetable, one component across edit, preview, and
// export. This is a positioned block, the row and the block's extent already encode the
// meeting time, so its hierarchy inverts the usual reading order (ADR-0047): the subject
// name is the primary anchor at the top, the place is the promoted second line with a
// location glyph, and the time demotes to quiet tabular metadata at the foot beside the
// subject id. Two principles govern this: the time earns emphasis only where position does
// not encode it, which is why it is prominent on the hover card and the text export but quiet
// here (the H3 principle), and a glyph marks a promoted field only, which is why the promoted
// place keeps its location pin while the demoted time carries no glyph.
// The fill is a soft tint of the subject's stable color under ink text with the solid color
// as a left bar (ADR-0035); the KMITL orange is never used here. On the export poster and
// in the edit grid alike the content is measured against the box and whole low
// priority fields are dropped rather than a line clipped mid glyph: the fit walks the
// density ladder in useDensityFit, dropping the subject id, then the English name, then the
// time, then the section chip, then reducing the name to one line, then the place, with the
// name never dropping (ADR-0046, ADR-0047). The place outlives the name's second line and
// the time never outlives the place. The edit block keeps its tighter line height and always
// carries the subject id for cross referencing, so the id is the first field it drops; the
// hover card and the details still show it (ADR-0050). The edit fit pauses during a drag.
// In edit mode the block is a drag source (the ref and
// listeners come from the draggable wrapper so this stays free of the drag library) and
// is itself the button that opens the pinned detail popover on click or Enter and Space,
// the keyboard path to details and actions; the hover card shows the same detail on hover
// (ADR-0044), so the block carries no separate info affordance. The only chrome control is
// the quiet remove button, kept a sibling of the interactive block rather than nested
// inside it so no interactive control nests in another; a positioning wrapper holds both.
// The verification marks are an editing signal for the plan owner, so the export poster
// renders the block without them (ADR-0055).

import {
  memo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { MapPin, X } from 'lucide-react';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { hashColor, hashTint } from '@/lib/utils/hash-color';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { buildEligibility } from '@/lib/planner/blockDensity';
import type { PlacedSection } from './placedSection';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { useDensityFit } from './useDensityFit';
import { PRESSED_CLASS } from './useTouchPress';

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
  /** The drag listeners, present only for an edit mode drag source. */
  dragListeners?: DraggableSyntheticListeners;
  /** Whether a finger holds the block long enough to read as pressed, ahead of its drag. */
  pressed?: boolean;
  /** Remove this section from the plan by its id, present only in edit mode. The
   * block passes its own id so the grid can hand down one stable handler rather than
   * a fresh per block closure, which keeps this memoized block from re-rendering. */
  onRemove?: (teachTableId: string) => void;
  removeLabel?: string;
  /** Open the block detail popover anchored to this block, edit mode only. When set the
   * block is a button: a click or Enter or Space opens the pinned popover. */
  onOpenDetail?: (anchor: HTMLElement) => void;
  /** Open the block context menu at the pointer on a right click, edit mode only. A
   * touch long press is a drag, so a context menu event from a finger is swallowed. */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Report a mouse entering the block, so the grid can open a hover detail card. A touch
   * never reports, so a tap opens only the detail sheet (ADR-0058). */
  onHoverEnter?: (anchor: HTMLElement) => void;
  /** Report the pointer leaving the block, so the grid can dismiss the hover card. */
  onHoverLeave?: () => void;
  /** Show the room line. A preview display option; on by default in edit mode. */
  showRoom?: boolean;
  /** Show the section code beside the subject id. On by default in edit mode. */
  showSection?: boolean;
  /** Add the English name as a secondary line under a Thai primary name. */
  showEnglishName?: boolean;
  /** Show the subject id in the foot. A preview display option, off by default there; the
   * edit grid leaves it on so the id is always available for cross referencing. */
  showSubjectId?: boolean;
  /** A key that changes whenever the block box pixel size changes (font, orientation,
   * window, day count, grid track), so the measured fit resets to the full field set and
   * re-measures (ADR-0046, ADR-0050). */
  fitKey?: string;
  /** Hold the settled field set and skip measurement, set for the length of an edit drag
   * so the fit never reads layout while the pointer moves. */
  fitPaused?: boolean;
  /** Raise the line height so stacked Thai vowels and tone marks sit inside the line box.
   * On for the export poster, where the raster must never crop a mark; the edit grid keeps
   * its tighter line height so a block holds more fields (ADR-0046). */
  thaiHeadroom?: boolean;
  /** Draw the verification and conflict marks: the status dot, the hatch, the danger ring,
   * and the badge text in the accessible name. On in edit mode; the export poster turns it
   * off and states the same facts as footer text, so a shared image stays clean (ADR-0055). */
  showVerification?: boolean;
  /** Pin the foot to the bottom of the box. On for the export poster, so its measured fit
   * and export pixels hold; the edit foot follows the place line instead. */
  footAtBottom?: boolean;
}

/** Whether a context menu event came from a finger. Chromium delivers the event as a
 * pointer event that names its pointer type; an event without one is a mouse or a key. */
function isTouchContextMenu(event: globalThis.MouseEvent): boolean {
  return 'pointerType' in event && event.pointerType === 'touch';
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
  pressed = false,
  onRemove,
  removeLabel,
  onOpenDetail,
  onContextMenu,
  onHoverEnter,
  onHoverLeave,
  showRoom = true,
  showSection = true,
  showEnglishName = false,
  showSubjectId = true,
  fitKey = '',
  fitPaused = false,
  thaiHeadroom = false,
  showVerification = true,
  footAtBottom = false,
}: EventBlockProps) {
  const name = locale === 'th' ? section.nameTh : section.nameEn;
  // The English name is guaranteed visible when the option is on: it is the primary
  // in English, so it only needs adding as a secondary line under a Thai primary.
  const englishSecondary =
    showEnglishName && locale === 'th' && section.nameEn !== '';
  const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
  const badge = showVerification
    ? blockBadge(section.verifyStatus, conflicted, examConflicted)
    : null;
  const badgeText = showVerification
    ? blockBadgeLabelKeys(section.verifyStatus, conflicted, examConflicted)
        .map((key) => t(key))
        .join(' ')
    : '';
  // Room and building read together as the place. Both can be empty on an online
  // course, so the middot separator only appears when both are present.
  const place = [meeting.building, meeting.room]
    .filter((part) => part !== '')
    .join(' · ');
  // Which fields this block could show before any measurement, from its data and the display
  // toggles. The measured fit then drops the lowest priority of these that do not fit the
  // box.
  const contentRef = useRef<HTMLDivElement>(null);
  const eligibility = buildEligibility({
    hasName: name !== '',
    hasEnglish: englishSecondary,
    hasSection: showSection && section.section !== '',
    hasId: showSubjectId && section.subjectId !== '',
    hasPlace: showRoom && place !== '',
  });
  const level = useDensityFit(contentRef, eligibility, fitKey, fitPaused);
  // The accessible name is self contained so a screen reader hears the whole meeting
  // from the block alone: subject, name, section, full day, time, the place when it is
  // shown, then any verification state. The place follows the visual toggle so the
  // label matches what is on screen.
  const placeText = showRoom && place !== '' ? ` ${place}` : '';
  const label = `${section.subjectId} ${name} ${t('section.code')} ${section.section} ${t(dayFullLabelKey(meeting.day))} ${time}${placeText}${
    badgeText === '' ? '' : ` ${badgeText}`
  }`;
  // When onOpenDetail is set the block itself is the button that opens the pinned popover,
  // so a click or Enter or Space anchors it to this block. A drag past the activation
  // distance suppresses the click, so this fires only on a real click, not the tail of a
  // drag. In preview and export the handler is absent and the block stays inert.
  const interactive = onOpenDetail !== undefined;
  const handleContextMenu =
    onContextMenu === undefined
      ? undefined
      : (event: MouseEvent<HTMLDivElement>) => {
          if (isTouchContextMenu(event.nativeEvent)) {
            // The long press already started a block drag; neither the browser menu nor
            // the block menu belongs on top of it (ADR-0058).
            event.preventDefault();
            return;
          }
          onContextMenu(event);
        };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail?.(event.currentTarget);
    }
  };

  // A positioning wrapper carries the grid coordinates and the hover group. It holds the
  // interactive block and, as a sibling rather than a descendant, the remove button, so no
  // interactive control nests inside another (axe nested-interactive).
  return (
    <div
      className={`group/block relative m-px flex min-w-0 ${dimmed ? 'opacity-40' : ''}`}
      style={style}
    >
      <div
        ref={dragRef}
        data-teach-table-id={section.teachTableId}
        data-verify={badge ?? undefined}
        aria-label={label}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={
          interactive
            ? (event) => {
                // onOpenDetail is narrowed non-nullish by the interactive alias here.
                onOpenDetail(event.currentTarget);
              }
            : undefined
        }
        onKeyDown={interactive ? handleKeyDown : undefined}
        onContextMenu={handleContextMenu}
        onPointerEnter={
          onHoverEnter !== undefined
            ? (event) => {
                if (event.pointerType === 'mouse') {
                  onHoverEnter(event.currentTarget);
                }
              }
            : undefined
        }
        onPointerLeave={onHoverLeave}
        // The pressed outline replaces outline-none, which would otherwise zero the
        // outline style the pressed look sets.
        className={`kcp-settle relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-kcp py-1.5 pr-2 pl-2.5 text-[1em] ${thaiHeadroom ? 'leading-[1.5]' : 'leading-tight'} text-ink ${pressed ? PRESSED_CLASS : 'outline-none'} ${pulsing ? 'kcp-pulse' : ''} ${dragListeners ? 'touch-drag cursor-grab' : ''} ${badge === 'danger' ? 'ring-2 ring-danger ring-inset' : ''} ${interactive ? 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary' : ''}`}
        style={{ backgroundColor: hashTint(section.subjectId) }}
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
        {/* Section as a small floating chip in the top right corner. It steps aside on hover
            and focus in edit mode, where the remove control takes that corner. */}
        {level.showSection ? (
          <span className="pointer-events-none absolute top-1 right-1 rounded bg-ink/10 px-1 text-[0.85em] text-ink group-hover/block:opacity-0 group-focus-within/block:opacity-0">
            {section.section}
          </span>
        ) : null}
        {/* The measured content column. This is a positioned block, the row and the block's
            extent already encode the time, so the hierarchy inverts (ADR-0047): the subject name
            is the primary anchor at the top, the place is the promoted second line with a
            location glyph, and the time demotes to quiet metadata at the foot beside the subject
            id. The name is pinned and never drops; the fit measures this column and drops the
            lowest priority fields whole rather than clipping a line. The absolute chip
            and badges sit outside this column so they never skew the measurement. */}
        <div
          ref={contentRef}
          data-fit
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <span
            lang={locale}
            className={`${level.nameLines === 2 ? 'line-clamp-2' : 'line-clamp-1'} shrink-0 pr-6 font-semibold break-words hyphens-auto`}
          >
            {name}
          </span>
          {level.showEnglish ? (
            <span
              lang="en"
              className="line-clamp-1 shrink-0 font-normal break-words text-ink-soft hyphens-auto"
            >
              {section.nameEn}
            </span>
          ) : null}
          {level.showPlace ? (
            <span className="mt-0.5 flex shrink-0 items-center gap-1 text-ink">
              <MapPin
                size="0.85em"
                strokeWidth={2}
                aria-hidden
                className="shrink-0"
                style={{ color: hashColor(section.subjectId) }}
              />
              <span className="truncate">{place}</span>
            </span>
          ) : null}
          {/* On the poster the foot sits at the bottom of the fitted box. In edit it follows
              the place closely, so a tall block reads as one cluster with its spare height
              below rather than split into a top and a bottom group. */}
          <div
            className={`${footAtBottom ? 'mt-auto' : 'mt-1'} min-h-0 pt-0.5 text-ink-soft`}
          >
            {level.showTime ? (
              <span className="block text-[0.9em] tabular-nums">{time}</span>
            ) : null}
            {level.showId ? (
              <span className="block truncate">{section.subjectId}</span>
            ) : null}
          </div>
        </div>
      </div>
      {onRemove !== undefined ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={() => {
            onRemove(section.teachTableId);
          }}
          className="absolute top-0.5 right-0.5 z-grid rounded bg-ink/5 p-0.5 text-ink-soft opacity-0 outline-none group-hover/block:opacity-100 group-focus-within/block:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <X size={12} aria-hidden />
        </button>
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
