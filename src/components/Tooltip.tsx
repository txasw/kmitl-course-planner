// A hover and focus tooltip that meets WCAG 1.4.13. It shows on pointer hover
// after a short delay and on keyboard focus, stays while the pointer travels onto
// its own content (safePolygon) so the content is hoverable, and dismisses on
// Escape without closing the overlay. It positions with floating-ui like the other
// panel popups, a fixed strategy that flips and shifts within the panel, and
// portals into the shadow root overlay node so a transformed drawer never clips or
// mispositions it. It appears without motion, so there is no reduced motion path.
//
// The trigger is a render prop so the caller attaches the reference ref through a
// JSX ref and spreads the interaction props onto its own element, which keeps the
// tooltip layout free (no wrapper) and satisfies the refs lint rule that forbids a
// ref object key passed to a function during render.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';

type TriggerRef = (node: Element | null) => void;

interface TooltipProps {
  /** The tooltip text. It also becomes the reference's aria-describedby target. */
  label: ReactNode;
  /** Render the trigger. Attach `ref` through the element's JSX ref and spread
   * `triggerProps` onto it so the tooltip anchors to it and receives hover and
   * focus, while the element keeps its own handlers and classes. */
  children: (
    triggerProps: Record<string, unknown>,
    ref: TriggerRef,
  ) => ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const portalRoot = usePanelPortal();

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'top',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    move: false,
    delay: { open: 350, close: 0 },
    handleClose: safePolygon(),
  });
  const focus = useFocus(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    role,
  ]);

  // Wrap the floating ref setters so they are not read during render, which the
  // refs lint rule forbids; the memoized callbacks attach through JSX refs.
  const setReference = useCallback<TriggerRef>(
    (node) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  // WCAG 1.4.13 dismissible: Escape hides the tooltip. A capture phase document
  // listener catches it whether the tooltip opened from hover or focus, and stops
  // propagation so the overlay focus trap, which listens on the panel in the
  // bubble phase, does not also close the whole panel.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const content = open ? (
    <div
      ref={setFloating}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-[2147483647] max-w-56 rounded-kcp border border-border bg-surface px-2 py-1 text-xs text-ink shadow-kcp"
    >
      {label}
    </div>
  ) : null;

  return (
    <>
      {children(getReferenceProps(), setReference)}
      {/* Portal into the shadow root overlay node so a transformed drawer cannot
          clip the tooltip. With no portal node, such as in tests, render inline. */}
      {portalRoot === null ? (
        content
      ) : (
        <FloatingPortal root={portalRoot}>{content}</FloatingPortal>
      )}
    </>
  );
}
