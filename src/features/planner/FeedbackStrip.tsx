// The placement feedback strip: a slim aria-live region. On the docked tiers it sits at
// the top of the grid column under the grid header, with a reserved height so a notice
// never shifts the grid. Below the dock it floats at the bottom of the open catalog
// sheet, or of the grid while the sheet is closed, above the sheet's scrim and above a
// toast at the panel foot, so its chips are never dimmed or covered. Below 640 px it
// floats over whichever pane shows, at most 32rem wide, above the bottom nav and the
// device's bottom inset. Floating, it reserves the space it covers at the foot of the
// catalog scrollers, so a control focused there is never hidden under it (WCAG 2.4.11).
// It mounts once at every tier, so one live node speaks each outcome. A rejected drop shows the blocking reason and up to two
// alternative sections of the same subject that would fit, or a reveal action when none
// do. A cross term add and a drag hint show here too. Each visible notice ends with a
// dismiss control and clears on its own window, six seconds for the blocked reason,
// which pauses while the pointer rests on the strip or focus is inside it. A catalog
// add is confirmed by a screen reader only line here only while the timetable is in
// view; while the sheet covers it, the add toast speaks instead and this line stays
// empty, so the add is read once. It is not the toast, which stays reserved for actions
// whose outcome is not otherwise visible on screen; the undo for a removal, move, or
// swap is an undo toast in the bottom region, where the eye already is on the block
// that changed. A notice that clears while one of its controls holds focus hands focus
// back to the control it came from, so the timer that clears it never drops focus to
// the document body. The notices themselves live in FeedbackNotices.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useStore } from 'zustand';
import type { Translate } from '@/lib/i18n/t';
import { planStore, usePlacedSections } from '@/features/plans/planStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { focusFirst } from '@/features/shell/restoreFocus';
import { focusIsLost } from '@/features/shell/useFocusTrap';
import { useAutoClear } from '@/features/shell/useAutoClear';
import { useElementSize } from '@/features/shell/useElementSize';
import { useTranslation } from '@/features/shell/useTranslation';
import { uiStore } from '@/features/shell/uiStore';
import { toastStore } from '@/features/shell/toastStore';
import { dragStore } from './dragStore';
import { BlockedNotice, CrossTermNotice, HintNotice } from './FeedbackNotices';

const BLOCKED_WINDOW_MS = 6_000;
const ANNOUNCE_WINDOW_MS = 4_000;

/**
 * Where the strip sits: in the grid column on the docked tiers, or floating at the foot
 * of the open sheet or of the grid below them.
 */
export type StripPlacement = 'inline' | 'sheet' | 'grid';

/** The custom property a floating strip sets on its container while it covers space. */
export const OVERLAY_BOTTOM_PROPERTY = '--kcp-overlay-bottom';

// The floating strip lets the pointer through outside its notice, and lifts the notice
// onto a raised surface. Over the sheet it takes the sheet's width less its margins.
const FLOATING =
  'pointer-events-none absolute z-drawer *:pointer-events-auto *:shadow-kcp';

const PLACEMENT_CLASS: Record<StripPlacement, string> = {
  inline: 'min-h-[1.75rem] shrink-0',
  sheet: `${FLOATING} left-4 w-[calc(min(24rem,90vw)-2rem)]`,
  grid: `${FLOATING} inset-x-4 mx-auto max-w-[32rem]`,
};

// How far the floating strip sits above the foot of its container: clear of the panel
// edge at rest, and clear of the toast region, which shares the panel foot, while a toast
// shows. The strip outranks a toast, since its chips are the next step. Below 640 px the
// container runs to the screen edge behind the 56 px bottom nav, which pads by the bottom
// safe area inset, so the strip adds the inset and rises clear of the nav, and above the
// toast that itself rises 72 px over the nav. Above 640 px the overlay body already clears
// the inset.
interface FloatOffset {
  className: string;
  px: number;
  /** Whether the offset adds the bottom safe area inset to its pixels. */
  inset: boolean;
}

const FLOAT_OFFSET = {
  rest: { className: 'bottom-4', px: 16, inset: false },
  aboveToast: { className: 'bottom-24', px: 96, inset: false },
  aboveNav: {
    className: 'bottom-[calc(72px+var(--kcp-safe-bottom))]',
    px: 72,
    inset: true,
  },
  aboveNavAndToast: {
    className: 'bottom-[calc(144px+var(--kcp-safe-bottom))]',
    px: 144,
    inset: true,
  },
} as const satisfies Record<string, FloatOffset>;

function floatOffset(aboveToast: boolean, aboveNav: boolean): FloatOffset {
  if (aboveNav) {
    return aboveToast ? FLOAT_OFFSET.aboveNavAndToast : FLOAT_OFFSET.aboveNav;
  }
  return aboveToast ? FLOAT_OFFSET.aboveToast : FLOAT_OFFSET.rest;
}

// The gap a scroller under the floating strip keeps above it as well as its height.
const OVERLAY_GAP_PX = 8;

interface FeedbackStripProps {
  t: Translate;
  placement?: StripPlacement;
  /** Whether a toast shows at the panel foot, which a floating strip rises above. */
  aboveToast?: boolean;
  /** Whether the phone layout's bottom nav runs along the container foot. */
  aboveNav?: boolean;
}

/**
 * Keeps the space a floating strip covers clear at the foot of the scrollers under it,
 * by setting the overlay property on the strip's container while the strip has a
 * height. The scrollers read it as their scroll padding, so focus and scrolling stop
 * short of the strip.
 */
function useOverlayClearance(
  ref: RefObject<HTMLDivElement | null>,
  offset: FloatOffset | null,
): void {
  const { height } = useElementSize(ref);
  const px = offset === null ? null : height + offset.px + OVERLAY_GAP_PX;
  const inset = offset?.inset ?? false;
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (container == null || px === null || height === 0) {
      return undefined;
    }
    container.style.setProperty(
      OVERLAY_BOTTOM_PROPERTY,
      inset
        ? `calc(${String(px)}px + var(--kcp-safe-bottom))`
        : `${String(px)}px`,
    );
    return () => {
      container.style.removeProperty(OVERLAY_BOTTOM_PROPERTY);
    };
  }, [ref, px, inset, height]);
}

export function FeedbackStrip({
  t,
  placement = 'inline',
  aboveToast = false,
  aboveNav = false,
}: FeedbackStripProps) {
  const blocked = useStore(dragStore, (state) => state.blocked);
  const crossTerm = useStore(dragStore, (state) => state.crossTerm);
  const announcement = useStore(dragStore, (state) => state.announcement);
  const hint = useStore(dragStore, (state) => state.hint);
  const placed = usePlacedSections();
  const stripRef = useRef<HTMLDivElement>(null);
  const floating = placement !== 'inline';
  const offset = floatOffset(aboveToast, aboveNav);
  useOverlayClearance(stripRef, floating ? offset : null);
  // The control focus came from when it entered the strip, such as the add button whose
  // blocked add moved focus to the first alternative. It is forgotten once focus moves on
  // to a control outside the strip, which then owns it.
  const originRef = useRef<HTMLElement | null>(null);
  // The notice showing when focus came in. Focus pauses that notice only: a control
  // that unmounts with its notice sends no blur, so a flag would stay set and hold the
  // next notice forever.
  const [focusedNotice, setFocusedNotice] = useState<unknown>(null);
  const [hovered, setHovered] = useState(false);
  const visible = crossTerm ?? blocked ?? hint ?? announcement;
  const handleFocusIn = (event: FocusEvent<HTMLDivElement>) => {
    setFocusedNotice(visible);
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
      originRef.current = from;
    }
  };
  const handleFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget;
    if (to instanceof Node && event.currentTarget.contains(to)) return;
    setFocusedNotice(null);
    if (to instanceof Node) {
      originRef.current = null;
    }
  };
  // A finger that taps the strip sends no leave until it touches elsewhere, so only a
  // hovering pointer pauses it.
  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') setHovered(true);
  };
  const handlePointerLeave = () => {
    setHovered(false);
  };
  // Runs in the commit that swapped the notice, before the focus trap checks for dropped
  // focus, so focus returns straight to its origin rather than to the panel. An origin
  // that the same change removed, such as an add button whose course was just added, is
  // skipped, and the action that removed it moves focus itself.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const origin = originRef.current;
    if (strip === null || origin === null || !focusIsLost(strip)) return;
    originRef.current = null;
    focusFirst([origin]);
  }, [blocked, crossTerm, hint, announcement]);

  // Every notice waits on one pausable window: it holds while the pointer rests on the
  // strip or focus is inside it, and resumes with the time left (WCAG 2.2.1).
  const paused =
    hovered || (focusedNotice !== null && focusedNotice === visible);
  const drag = dragStore.getState();
  useAutoClear(blocked, BLOCKED_WINDOW_MS, drag.clearBlocked, paused);
  useAutoClear(crossTerm, BLOCKED_WINDOW_MS, drag.clearCrossTerm, paused);
  useAutoClear(hint, BLOCKED_WINDOW_MS, drag.clearHint, paused);
  useAutoClear(
    announcement,
    ANNOUNCE_WINDOW_MS,
    drag.clearAnnouncement,
    paused,
  );

  return (
    <div
      ref={stripRef}
      aria-live="polite"
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`${PLACEMENT_CLASS[placement]} ${floating ? offset.className : ''}`}
    >
      {crossTerm !== null ? (
        <CrossTermNotice feedback={crossTerm} t={t} />
      ) : blocked !== null ? (
        <BlockedNotice blocked={blocked} placed={placed} t={t} />
      ) : hint !== null ? (
        <HintNotice hint={hint} boxed={floating} t={t} />
      ) : announcement !== null ? (
        <span className="sr-only">{announcement}</span>
      ) : null}
    </div>
  );
}

/**
 * The strip below the docked tiers, floating at the foot of the open sheet or of the
 * grid. It reads the sheet state itself, so the layout that renders it subscribes to
 * nothing more.
 */
export function FloatingFeedbackStrip() {
  const { t } = useTranslation();
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  // The toaster shows an undo or an ordinary toast while either is pending; the strip
  // mounts only inside the open panel, where the undo toast always shows.
  const toastShows = useStore(toastStore, (state) => state.toast !== null);
  const undoShows = useStore(planStore, (state) => state.pendingUndo !== null);
  const compact = useLayoutTier() === 'compact';
  // The compact tier has no sheet, so a sheet left open on a wider window that narrowed
  // below 640 px never gives the strip the sheet's width there.
  return (
    <FeedbackStrip
      t={t}
      placement={sheetOpen && !compact ? 'sheet' : 'grid'}
      aboveToast={toastShows || undoShows}
      aboveNav={compact}
    />
  );
}
