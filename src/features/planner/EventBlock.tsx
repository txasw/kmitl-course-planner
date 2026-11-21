// A single placed meeting on the timetable, one component across edit, preview, and
// export. This is a positioned block, the row and the block's extent already encode the
// meeting time, so its hierarchy inverts the usual reading order (ADR-0047): the subject
// name is the primary anchor at the top, the place is the promoted second line with a
// location glyph, and the time demotes to quiet tabular metadata at the foot beside the
// subject id. Two principles govern this: the time earns emphasis only where position does
// not encode it, which is why it is prominent on the hover card and the text export but quiet
// here (the H3 principle), and a glyph marks a promoted field only, which is why the promoted
// place keeps its location pin while the demoted time carries no glyph.
// The fill is a tint of the subject's stable color under ink text with the solid color as a
// left stripe; the KMITL orange is never used here. The edit grid and the suggestion mini
// grids take the soft depth card, a fill that fades from a stronger tint at the top with a
// tinted edge and a light shadow; the preview poster and its export keep the flat tint and
// bar of ADR-0035, so the raster never depends on a gradient (ADR-0047 amendment of
// 2026-11-20). The danger state draws its ring and hatch on an overlay rather than on the
// fill, so it reads the same on either surface, and each text line sits on a solid tint above
// the overlay, so the stripes never run through the text. On the export poster and in the
// edit grid alike the content is measured against the box and whole low priority fields are
// dropped rather than a line clipped mid glyph: the fit walks the density ladder in useDensityFit,
// dropping the subject id, then the secondary name, then the time, then clamping the name
// to the lines that fit, then the section chip, then reducing the name to one line, then
// the place, with the name never dropping (ADR-0046, ADR-0047). The place outlives the
// name's second line and the time never outlives the place. The subject id and the time
// never wrap and drop whole when wider than the block, so a code is never cut at the edge.
// The edit block keeps its tighter line height, always carries the subject id for cross
// referencing, and names the subject in both languages, the panel language first, so the id is
// the first field it drops and the second name the next; the hover card and the details still
// show both (ADR-0050). The edit fit pauses during a drag. In edit mode the block is a drag
// source (the ref and listeners come from the draggable wrapper so this stays free of the
// drag library) and is itself the button that opens the pinned detail popover on click or
// Enter and Space, the keyboard path to details and actions; the hover card shows the same
// detail on hover (ADR-0044), so the block carries no separate info affordance. The only
// chrome control is the quiet remove button, kept a sibling of the interactive block rather
// than nested inside it so no interactive control nests in another; a positioning wrapper
// holds both. Under a coarse pointer the remove button is hidden: a 44 px target would
// cover a short block, and the detail sheet that a tap or Enter on the block opens carries
// Remove, so a touch laptop used with a keyboard keeps a keyboard path to removal
// (ADR-0058). Where the grid asks for the name only rule, a block narrower than 7em hides
// it too, for the same reason and with the same path, so it never covers the name such a
// block shows alone. The verification marks are an editing signal for the plan owner, so
// the export poster renders the block without them (ADR-0055). In the phone day view the
// block is a tall full width card, so it lays its content out as the day card instead, the
// time range first and the chips at its foot, over the same fill, stripe, marks, drag, and
// remove control (ADR-0047 amendment of 2026-11-21).

import {
  memo,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { X } from 'lucide-react';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { hashColor } from '@/lib/utils/hash-color';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_MIN } from '@/lib/ui/target';
import { buildEligibility } from '@/lib/planner/blockDensity';
import { abbreviationSteps } from '@/lib/planner/abbreviateName';
import {
  subjectNameLines,
  type NameLanguage,
} from '@/lib/planner/nameLanguage';
import type { PlacedSection } from './placedSection';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { useDensityFit } from './useDensityFit';
import { EventBlockContent } from './EventBlockContent';
import { DayCardContent } from './DayCardContent';
import { NARROW_HIDDEN, NARROW_PADDING } from './narrowBlock';
import {
  stripeClass,
  surfaceClass,
  surfaceStyle,
  type BlockSurface,
} from './blockSurface';
import { PRESSED_CLASS } from './useTouchPress';
import { meetingOrder } from './blockFocus';

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
  /** The language the block names its subject in, Thai, English, or both; unset follows the
   * locale. A preview display option; the edit grid always passes both. */
  nameLanguage?: NameLanguage | undefined;
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
  /** The fill: the soft depth card, the default, or the flat tint the poster keeps. */
  surface?: BlockSurface;
  /** Show the name alone while the block is narrower than 7em. Set only where the block
   * width is a day column or a suggestion slide track: the portrait edit grid and the
   * suggestion slides. A landscape block is as wide as its meeting is long, so a short meeting there
   * walks the density ladder instead, and the poster never takes the rule (ADR-0047). */
  nameOnlyWhenNarrow?: boolean;
  /** Lay the content out as the phone day card: the block is the full width of the day view
   * and tall, so the time leads and the chips sit at the foot (ADR-0047 amendment). */
  dayCard?: boolean;
}

/** Whether a context menu event came from a finger. Chromium delivers the event as a
 * pointer event that names its pointer type; an event without one is a mouse or a key. */
function isTouchContextMenu(event: globalThis.MouseEvent): boolean {
  return 'pointerType' in event && event.pointerType === 'touch';
}

/** The block outline: the pressed look while a finger holds it, otherwise the focus
 * outline on an interactive block, and no outline on a static one. */
function blockOutlineClass(pressed: boolean, interactive: boolean): string {
  if (pressed) {
    return PRESSED_CLASS;
  }
  return interactive ? FOCUS_OUTLINE : 'outline-none';
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
  nameLanguage,
  showSubjectId = true,
  fitKey = '',
  fitPaused = false,
  thaiHeadroom = false,
  showVerification = true,
  footAtBottom = false,
  surface = 'soft',
  nameOnlyWhenNarrow = false,
  dayCard = false,
}: EventBlockProps) {
  const names = subjectNameLines(section, nameLanguage, locale);
  const name = names.primary;
  const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
  const color = hashColor(section.subjectId);
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
  // The shortened forms a name in Latin script steps through where a word is wider than its
  // line, so the name never gives way to the subject id (ADR-0047 amendment of 2026-11-22).
  const abbreviations = useMemo(() => abbreviationSteps(name), [name]);
  const eligibility = buildEligibility({
    hasName: name !== '',
    hasSecondary: names.secondary !== null,
    hasSection: showSection && section.section !== '',
    hasId: showSubjectId && section.subjectId !== '',
    hasPlace: showRoom && place !== '',
    nameAbbreviations: abbreviations.length,
  });
  // The name joins the reset key, since a locale switch can swap in a name of the same field
  // set and abbreviation count that needs a fresh fit from the full level.
  const level = useDensityFit(
    contentRef,
    eligibility,
    `${fitKey}|${name}`,
    fitPaused,
    dayCard ? 'dayCard' : 'block',
  );
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
  // drag. In preview and export the handler is absent and the block stays inert, as a group so
  // a screen reader announces the label with the full name rather than an abbreviated form.
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
      className={`group/block relative m-px flex min-w-0 ${nameOnlyWhenNarrow ? '@container' : ''} ${dimmed ? 'opacity-40' : ''}`}
      style={style}
    >
      <div
        ref={dragRef}
        data-teach-table-id={section.teachTableId}
        data-block-order={interactive ? meetingOrder(meeting) : undefined}
        data-verify={badge ?? undefined}
        data-surface={surface}
        aria-label={label}
        role={interactive ? 'button' : 'group'}
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
        // outline style the pressed look sets. An interactive block takes the offset
        // focus outline rather than an inset ring, because the danger overlay carries the
        // inset ring. Under the name only rule a block narrower than 7em tightens its
        // padding so its name keeps the width to break between words.
        className={`kcp-settle relative flex min-w-0 flex-1 flex-col overflow-hidden ${dayCard ? 'py-2 pr-2.5 pl-3.5' : 'py-1.5 pr-2 pl-2.5'} text-[1em] ${nameOnlyWhenNarrow ? NARROW_PADDING : ''} ${surfaceClass(surface)} ${thaiHeadroom ? 'leading-[1.5]' : 'leading-tight'} text-ink ${blockOutlineClass(pressed, interactive)} ${pulsing ? 'kcp-pulse' : ''} ${dragListeners ? 'touch-drag cursor-grab' : ''}`}
        style={surfaceStyle(surface, section.subjectId)}
        {...dragListeners}
      >
        {/* The solid subject color as a left stripe carries the identity; the fill is a
            tint of it under ink text. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 ${stripeClass(surface)}`}
          style={{ backgroundColor: color }}
        />
        {badge === 'danger' ? (
          <span
            aria-hidden
            className="kcp-hatch pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-danger ring-inset"
          />
        ) : null}
        {dayCard ? (
          <DayCardContent
            contentRef={contentRef}
            level={level}
            name={name}
            nameLang={names.primaryLang}
            secondary={names.secondary}
            secondaryLang={names.secondaryLang}
            place={place}
            sectionCode={section.section}
            kind={meeting.kind}
            time={time}
            subjectId={section.subjectId}
            abbreviations={abbreviations}
            color={color}
            badge={badge}
            surface={surface}
            reserveRemove={onRemove !== undefined}
            t={t}
          />
        ) : (
          <EventBlockContent
            contentRef={contentRef}
            level={level}
            name={name}
            nameLang={names.primaryLang}
            secondary={names.secondary}
            secondaryLang={names.secondaryLang}
            place={place}
            sectionCode={section.section}
            time={time}
            subjectId={section.subjectId}
            abbreviations={abbreviations}
            color={color}
            badge={badge}
            surface={surface}
            reserveRemove={onRemove !== undefined}
            footAtBottom={footAtBottom}
            nameOnlyWhenNarrow={nameOnlyWhenNarrow}
          />
        )}
      </div>
      {onRemove !== undefined ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={() => {
            onRemove(section.teachTableId);
          }}
          className={`absolute top-0.5 right-0.5 z-grid inline-flex items-center justify-center rounded bg-ink/5 p-0.5 text-ink-soft opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 pointer-coarse:hidden ${nameOnlyWhenNarrow ? NARROW_HIDDEN : ''} ${FOCUS_RING} ${TARGET_MIN}`}
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
