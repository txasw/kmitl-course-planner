// A compact fact of the phone plan status row whose words stay one tap away (ADR-0049
// amendment of 2026-11-21). On a phone the row keeps to two lines, so a fact that needs a
// sentence, such as the credit load note or the verification time, shows as its glyph and
// number alone. The glyph is a button: its accessible name carries the full words, a mouse
// reads them as a tooltip, and a tap or Enter reveals them in a small popover beside it, the
// way a touch user, who never sees a hover tooltip, reads them. The popover is a disclosure
// rather than a modal: it follows its trigger in the reading order, so Tab moves from the
// trigger into any action the popover carries, and Escape or a press outside closes it,
// handing focus back to the trigger on Escape.

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { useClick, useDismiss, useInteractions } from '@floating-ui/react';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface StatusRevealProps {
  /** The full words of the fact: the trigger's accessible name and its mouse tooltip. */
  label: string;
  /** What the trigger shows, a glyph and at most a number with its unit. */
  children: ReactNode;
  /** What the popover reveals; the label in words when unset. */
  detail?: ReactNode;
  /** The tone of the trigger, a text colour class. */
  toneClass?: string;
}

export function StatusReveal({
  label,
  children,
  detail,
  toneClass = 'text-ink-soft',
}: StatusRevealProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();
  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 6,
    open,
    onOpenChange: setOpen,
    placement: 'top-start',
  });
  // Escape is routed through useEscapeLayer below, so the dismiss hook handles only a press
  // outside the popover.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { escapeKey: false }),
  ]);

  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node);
      triggerRef.current = node;
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  const closeToTrigger = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEscapeLayer(wrapperRef, closeToTrigger, open);

  return (
    <span ref={wrapperRef} className="inline-flex">
      <button
        ref={setReference}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className={`inline-flex items-center justify-center gap-1 rounded-kcp px-1 hover:bg-surface-alt ${toneClass} ${TARGET_SIZE} ${FOCUS_RING}`}
        {...getReferenceProps()}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={setFloating}
          id={popoverId}
          style={floatingStyles}
          data-status-reveal
          className={`z-popover flex ${PANEL_POPOVER_SCROLL} flex-col gap-2 rounded-kcp border border-border bg-surface p-2 text-xs text-ink shadow-kcp`}
          {...getFloatingProps()}
        >
          {detail ?? <p>{label}</p>}
        </div>
      ) : null}
    </span>
  );
}
