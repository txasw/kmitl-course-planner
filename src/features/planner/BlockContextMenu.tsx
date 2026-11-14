// A small custom context menu for a placed block, opened by a right click on the block in
// edit mode. It replaces the browser menu on a block and nowhere else, and offers the
// shortcuts that already exist on the block and its detail surface: details, copy subject
// id, and remove. Every keyboard and popover path stays intact; this is an enhancement,
// not a replacement. It is positioned with floating-ui against a virtual reference at
// the pointer, dismisses on an outside press, and intercepts Escape so it closes only the
// menu and not the overlay. A close returns focus to the block it opened on, unless a
// remove took the block away. The planner grid has no transformed ancestor, so it needs
// no portal.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDismiss, useInteractions } from '@floating-ui/react';
import { ClipboardCopy, Info, Trash2 } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { useReturnFocus } from '@/features/shell/restoreFocus';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';

interface BlockContextMenuProps {
  teachTableId: string;
  /** The block the menu opened on; focus returns to it when the menu closes. */
  anchor: HTMLElement;
  x: number;
  y: number;
  t: Translate;
  onClose: () => void;
  onRemove: (teachTableId: string) => void;
  onDetails: () => void;
  onCopySubjectId: () => void;
}

export function BlockContextMenu({
  teachTableId,
  anchor,
  x,
  y,
  t,
  onClose,
  onRemove,
  onDetails,
  onCopySubjectId,
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

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 4,
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    placement: 'right-start',
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

  useReturnFocus(anchor);

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
      className={`z-popover min-w-36 ${PANEL_POPOVER_SCROLL} rounded-kcp border border-border bg-surface py-1 text-sm shadow-kcp`}
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
        onClick={onCopySubjectId}
        className={`${itemClass} text-ink`}
      >
        <ClipboardCopy size={14} aria-hidden />
        {t('block.copySubjectId')}
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
