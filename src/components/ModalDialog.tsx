// A centered modal dialog for the medium and wide panel tiers, the counterpart of the
// BottomSheet on compact. It shares the sheet's layering: it portals into the overlay
// root through PanelPortalContext, so it stays inside the shadow scoped styles and never
// renders inside an aria-live region it was opened from, and a scrim dims the panel and
// closes the dialog on a click while staying out of the tab order and the accessibility
// tree, since the close button carries the same action.
//
// Focus is contained with the shared focus trap: it moves to the heading on open, wraps
// on Tab, and returns to the opener on close. A dialog whose likely next step is one
// action, such as a review that ends in an acknowledgement, can name that control as the
// landing point instead. Escape closes the dialog only, through the shared escape layer,
// so the overlay behind it stays open. The body is capped at 85 percent of the dynamic
// viewport height and scrolls inside, and the optional footer stays pinned below it. A
// list dialog takes the narrow width, a review the medium one, a card list the wide one,
// a comparison table the table width, and a side by side comparison the full one. A table
// that keeps its header row in view while it scrolls owns its scroll instead: a sticky
// header sticks to its nearest scrolling ancestor, so the body then only bounds the
// content and leaves the scroll to it. While mounted the dialog counts as an open
// surface, so an unasked one waits for it.

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
import { TARGET_SIZE } from '@/lib/ui/target';

const WIDTH_CLASS = {
  narrow: 'max-w-md',
  medium: 'max-w-[32rem]',
  wide: 'max-w-4xl',
  table: 'max-w-[64rem]',
  full: 'max-w-6xl',
} as const;

const BODY_CLASS = {
  body: 'kcp-scroll overflow-y-auto',
  content: 'flex flex-col',
} as const;

interface ModalDialogProps {
  /** The heading that names the dialog; it labels the dialog and takes focus on open. */
  title: ReactNode;
  /** The accessible name of the close button, already localized. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** The width cap, wide by default. */
  width?: keyof typeof WIDTH_CLASS;
  /** Actions pinned below the scrolling body. */
  footer?: ReactNode;
  /** The control that takes focus on open, in place of the heading. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** The id of the element in the body that describes the dialog. */
  describedBy?: string;
  /** Who scrolls the content: the dialog body by default, or the content itself. */
  scroll?: keyof typeof BODY_CLASS;
}

export function ModalDialog({
  title,
  closeLabel,
  onClose,
  children,
  width = 'wide',
  footer,
  initialFocusRef,
  describedBy,
  scroll = 'body',
}: ModalDialogProps) {
  const portalRoot = usePanelPortal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  // The layer mounts its node only once the portal root exists, which is a commit later
  // when the panel opens with the layer already shown, so focus and Escape wait for it.
  const portalReady = portalRoot !== null;
  useFocusTrap(dialogRef, portalReady);
  useOpenSurface(true);
  useEscapeLayer(dialogRef, onClose, portalReady);
  useEffect(() => {
    (initialFocusRef?.current ?? headingRef.current)?.focus();
  }, [initialFocusRef, portalReady]);

  if (portalRoot === null) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-sheet flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative flex max-h-[85dvh] w-full ${WIDTH_CLASS[width]} flex-col rounded-kcp bg-surface text-ink shadow-kcp outline-none`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border py-2 pr-2 pl-4">
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
            onClick={onClose}
            className={`flex size-9 shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className={`min-h-0 flex-1 p-4 text-sm ${BODY_CLASS[scroll]}`}>
          {children}
        </div>
        {footer !== undefined && footer !== null ? (
          <div className="shrink-0 border-t border-border px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    portalRoot,
  );
}
