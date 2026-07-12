// A small custom context menu for a placed block, opened by a right click on the block in
// edit mode. It replaces the browser menu on a block and nowhere else, and offers the two
// pointer only shortcuts that already exist on the block, remove and details. Every
// keyboard and popover path stays intact; this is an enhancement, not a replacement. It is
// positioned with floating-ui against a virtual reference at the pointer, dismisses on an
// outside press, and intercepts Escape so it closes only the menu and not the overlay. The
// planner grid has no transformed ancestor, so it needs no portal.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { Info, Trash2 } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';

interface BlockContextMenuProps {
  teachTableId: string;
  x: number;
  y: number;
  t: Translate;
  onClose: () => void;
  onRemove: (teachTableId: string) => void;
  onDetails: () => void;
}

export function BlockContextMenu({
  teachTableId,
  x,
  y,
  t,
  onClose,
  onRemove,
  onDetails,
}: BlockContextMenuProps) {
  const reference = useMemo(
    () => ({
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }),
    }),
    [x, y],
  );

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    strategy: 'fixed',
    placement: 'right-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // A virtual reference at the pointer, set after render so the ref is not read during it.
  useEffect(() => {
    refs.setPositionReference(reference);
  }, [refs, reference]);

  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  // Escape is handled manually below so it can stop propagation and close only the menu;
  // useDismiss keeps the outside press path.
  const dismiss = useDismiss(context, { escapeKey: false });
  const { getFloatingProps } = useInteractions([dismiss]);

  // Escape closes only the menu; stopping propagation keeps the overlay open, the same
  // pattern the block detail popover uses.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [onClose]);

  const firstItem = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstItem.current?.focus();
  }, []);

  const itemClass = `flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-alt ${FOCUS_RING}`;

  return (
    <div
      ref={setFloating}
      role="menu"
      tabIndex={-1}
      aria-label={t('block.menu')}
      style={floatingStyles}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      className="z-50 min-w-36 rounded-kcp border border-border bg-surface py-1 text-sm shadow-kcp"
      {...getFloatingProps()}
    >
      <button
        ref={firstItem}
        type="button"
        role="menuitem"
        onClick={onDetails}
        className={`${itemClass} text-ink`}
      >
        <Info size={14} aria-hidden />
        {t('block.details')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onRemove(teachTableId);
        }}
        className={`${itemClass} text-danger`}
      >
        <Trash2 size={14} aria-hidden />
        {t('action.remove')}
      </button>
    </div>
  );
}
