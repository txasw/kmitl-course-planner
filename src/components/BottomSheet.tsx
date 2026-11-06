// A modal bottom sheet for narrow panels, where an anchored popover has no room beside
// its anchor. It portals into the overlay root through PanelPortalContext, so it stays
// inside the shadow scoped styles, escapes any transformed ancestor, and never renders
// inside an aria-live region it was opened from. A scrim dims the panel behind it and
// closes the sheet on a tap; it is not a tab stop and is hidden from assistive
// technology, because the close button carries the same action.
//
// Focus is contained with the shared focus trap: it moves to the heading on open, wraps
// on Tab, and returns to the opener on close. Escape closes the sheet only, through the
// shared escape layer, so the overlay behind it stays open. A downward swipe on the
// handle or the header also closes it; the body is left to the browser so a pan there
// scrolls and a tap there activates. The body is capped at 85 percent of the dynamic
// viewport height and scrolls inside, or the sheet fills the viewport when its content
// is a long review, and the optional footer stays pinned below it, padded clear of the
// home indicator. A sheet can name the control that takes focus on open in place of the
// heading, as the modal dialog can. Reduced motion drops the entrance and the swipe
// tracking, leaving the close button, the scrim, and Escape. While mounted the sheet
// counts as an open surface, so an unasked dialog waits for it to close.

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import { useOpenSurface } from '@/features/shell/attentionStore';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import { useFocusTrap } from '@/features/shell/useFocusTrap';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import { useSwipeGesture } from '@/features/shell/useSwipeGesture';

const SAFE_BOTTOM_PADDING = 'pb-[max(16px,var(--kcp-safe-bottom))]';

interface BottomSheetProps {
  /** The heading that names the sheet; it labels the dialog and takes focus on open. */
  title: ReactNode;
  /** The accessible name of the close button, already localized. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** Actions pinned below the scrolling body. */
  footer?: ReactNode;
  /** Whether the sheet fills the viewport height rather than fitting its content. */
  fullHeight?: boolean;
  /** The control that takes focus on open, in place of the heading. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** The id of the element in the body that describes the dialog. */
  describedBy?: string;
}

export function BottomSheet({
  title,
  closeLabel,
  onClose,
  children,
  footer,
  fullHeight = false,
  initialFocusRef,
  describedBy,
}: BottomSheetProps) {
  const portalRoot = usePanelPortal();
  const sheetRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const reducedMotion = usePrefersReducedMotion();

  useFocusTrap(sheetRef, true);
  useOpenSurface(true);
  useEscapeLayer(sheetRef, onClose);
  // The trap focuses the sheet itself; the heading is the clearer landing point because
  // it is read first and sits above the content.
  useEffect(() => {
    (initialFocusRef?.current ?? headingRef.current)?.focus();
  }, [initialFocusRef]);

  const swipe = useSwipeGesture({
    axis: 'y',
    onSwipe: (direction) => {
      if (direction === 1) {
        onClose();
      }
    },
    enabled: !reducedMotion,
  });

  if (portalRoot === null) {
    return null;
  }
  const hasFooter = footer !== undefined && footer !== null;

  return createPortal(
    <div className="fixed inset-0 z-sheet flex flex-col justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={swipe.style}
        className={`relative flex ${fullHeight ? 'h-dvh' : 'max-h-[85dvh]'} w-full flex-col rounded-t-kcp-sheet bg-surface text-ink shadow-kcp outline-none ${reducedMotion ? '' : 'kcp-sheet-enter'}`}
      >
        <div
          {...swipe.handlers}
          className={`shrink-0 select-none ${swipe.touchClass}`}
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-8 rounded-full bg-border-strong"
          />
          <div className="flex items-center gap-2 pr-1 pl-4">
            <h2
              ref={headingRef}
              id={titleId}
              tabIndex={-1}
              className="min-w-0 flex-1 text-base font-semibold outline-none"
            >
              {title}
            </h2>
            <button
              type="button"
              aria-label={closeLabel}
              // Keep a press on the close button from arming the swipe on the header,
              // whose pointer capture would otherwise swallow the click.
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={onClose}
              className={`flex size-11 shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div
          className={`kcp-scroll min-h-0 flex-1 overflow-y-auto px-4 text-sm ${hasFooter ? 'pb-4' : SAFE_BOTTOM_PADDING}`}
        >
          {children}
        </div>
        {hasFooter ? (
          <div
            className={`shrink-0 border-t border-border px-4 pt-3 ${SAFE_BOTTOM_PADDING}`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    portalRoot,
  );
}
