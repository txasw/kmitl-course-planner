// A centered modal dialog for the medium and wide panel tiers, the counterpart of the
// BottomSheet on compact. It shares the sheet's layering: it portals into the overlay
// root through PanelPortalContext, so it stays inside the shadow scoped styles and never
// renders inside an aria-live region it was opened from, and a scrim dims the panel and
// closes the dialog on a click while staying out of the tab order and the accessibility
// tree, since the close button carries the same action.
//
// Focus is contained with the shared focus trap: it moves to the heading on open, wraps
// on Tab, and returns to the opener on close. Escape closes the dialog only, through the
// shared escape layer, so the overlay behind it stays open. The body is capped at 85
// percent of the dynamic viewport height and scrolls inside.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import { useFocusTrap } from '@/features/shell/useFocusTrap';

interface ModalDialogProps {
  /** The heading that names the dialog; it labels the dialog and takes focus on open. */
  title: ReactNode;
  /** The accessible name of the close button, already localized. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalDialog({
  title,
  closeLabel,
  onClose,
  children,
}: ModalDialogProps) {
  const portalRoot = usePanelPortal();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, true);
  useEscapeLayer(dialogRef, onClose);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

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
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full max-w-4xl flex-col rounded-kcp bg-surface text-ink shadow-kcp outline-none"
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
            className={`flex size-9 shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="kcp-scroll min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {children}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
