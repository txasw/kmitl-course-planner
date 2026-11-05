// The anchored form of the block detail surface, for a fine pointer at 640 px and up. It
// floats beside the block through the shared panel popover recipe, a fixed strategy that
// escapes the panel and is sized to the space that remains, and dismisses on an outside
// click or Escape; Escape goes through the escape layer so it closes the popover rather
// than the whole overlay. The node is a column of a pinned header, a body that scrolls
// inside the capped height, and a pinned footer, so the actions stay in reach however
// long the detail list grows. Focus lands on the heading on open, the same landing point
// as the sheet form.

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDismiss, useInteractions } from '@floating-ui/react';
import { FOCUS_RING } from '@/lib/ui/focus';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';

interface BlockDetailPopoverProps {
  anchor: HTMLElement;
  /** The heading that names the dialog, the subject id and section code. */
  title: string;
  /** The subject name shown under the heading. */
  subtitle: ReactNode;
  /** The accessible name of the close button, already localized. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** Actions pinned below the scrolling body. */
  footer: ReactNode;
}

export function BlockDetailPopover({
  anchor,
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
  footer,
}: BlockDetailPopoverProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 6,
    open: true,
    onOpenChange: (next) => {
      if (!next) {
        onClose();
      }
    },
    placement: 'right-start',
    elements: { reference: anchor },
  });
  const { getFloatingProps } = useInteractions([useDismiss(context)]);
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
      wrapperRef.current = node;
    },
    [refs],
  );

  useEscapeLayer(wrapperRef, onClose);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      ref={setFloating}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-popover flex w-80 flex-col overflow-hidden rounded-kcp border border-border bg-surface text-xs text-ink shadow-kcp outline-none"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="font-semibold outline-none"
          >
            {title}
          </h2>
          <div className="truncate text-ink-soft">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`rounded-kcp p-0.5 text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className={`min-h-0 flex-1 px-3 pb-2 ${PANEL_POPOVER_SCROLL}`}>
        {children}
      </div>
      <div className="shrink-0 border-t border-border px-3 py-2">{footer}</div>
    </div>
  );
}
