// The block detail surface, edit mode only. It shows a placed section's full metadata
// through the full SectionDetailList, the same list the hover card renders compact, so the
// surface that touch and keyboard users reach carries every meeting, the seats from the
// latest verification, and the exam dates. Above the list sit its verification state with
// old versus new values for a changed field and any exam overlap, and below it the
// acknowledge and remove actions.
//
// From 640 px it is a popover anchored to the block with floating-ui, a fixed strategy
// that escapes the panel, and it dismisses on an outside click or Escape; Escape goes
// through the escape layer so it closes the popover rather than the whole overlay. Below
// 640 px there is no room beside the block, so the same content opens in a bottom sheet
// with the actions pinned in its footer (ADR-0049).

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { X } from 'lucide-react';
import { useDismiss, useInteractions } from '@floating-ui/react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { BottomSheet } from '@/components/BottomSheet';
import { planStore } from '@/features/plans/planStore';
import { useActiveRun } from '@/features/plans/revalidationStore';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { BlockDetailActions, BlockDetailBody } from './BlockDetailContent';

interface BlockDetailPopoverProps {
  teachTableId: string;
  anchor: HTMLElement;
  locale: Locale;
  t: Translate;
  onClose: () => void;
  onRemove: (teachTableId: string) => void;
  /** Exam window overlaps this block has with other entries, listed as a distinct
   * section so the reason reads apart from a revalidation change. */
  examOverlaps?: ExamOverlap[];
}

export function BlockDetailPopover({
  teachTableId,
  anchor,
  locale,
  t,
  onClose,
  onRemove,
  examOverlaps = [],
}: BlockDetailPopoverProps) {
  const entries = useStore(planStore, (state) => state.entries);
  const run = useActiveRun();
  const anchored = useMediaQuery(minWidthQuery(BREAKPOINTS.sm));

  const entry = entries.find((item) => item.teachTableId === teachTableId);

  // Close if the entry left the plan while the surface was open.
  useEffect(() => {
    if (entry === undefined) {
      onClose();
    }
  }, [entry, onClose]);

  if (entry === undefined) {
    return null;
  }

  const name =
    locale === 'th'
      ? entry.snapshot.subjectMeta.nameTh
      : entry.snapshot.subjectMeta.nameEn;
  const code = `${entry.subjectId} ${t('section.code')} ${entry.section}`;
  const body = (
    <BlockDetailBody
      entry={entry}
      diff={run?.report?.entries.find(
        (item) => item.teachTableId === teachTableId,
      )}
      examOverlaps={examOverlaps}
      locale={locale}
      t={t}
    />
  );
  const actions = (
    <BlockDetailActions
      entry={entry}
      t={t}
      onRemove={onRemove}
      onClose={onClose}
      touch={!anchored}
    />
  );

  if (!anchored) {
    return (
      <BottomSheet
        title={code}
        closeLabel={t('action.close')}
        onClose={onClose}
        footer={actions}
      >
        <p lang={locale} className="text-ink-soft">
          {name}
        </p>
        {body}
      </BottomSheet>
    );
  }

  return (
    <AnchoredPopover
      anchor={anchor}
      label={`${entry.subjectId} ${name}`}
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{code}</p>
          <p lang={locale} className="truncate text-ink-soft">
            {name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('action.close')}
          className="rounded-kcp p-0.5 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {body}
      <div className="mt-2 border-t border-border pt-2">{actions}</div>
    </AnchoredPopover>
  );
}

interface AnchoredPopoverProps {
  anchor: HTMLElement;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

// The floating container for the wide layout. It owns the floating-ui hooks so the sheet
// path never calls them, and focuses itself on open so a keyboard user lands inside.
function AnchoredPopover({
  anchor,
  label,
  onClose,
  children,
}: AnchoredPopoverProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Escape closes the popover only; the overlay focus trap would otherwise close the
  // whole panel first.
  useEscapeLayer(wrapperRef, onClose);
  useEffect(() => {
    wrapperRef.current?.focus();
  }, []);

  return (
    <div
      ref={setFloating}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={floatingStyles}
      {...getFloatingProps()}
      className={`z-popover w-80 ${PANEL_POPOVER_SCROLL} rounded-kcp border border-border bg-surface p-3 text-xs text-ink shadow-kcp outline-none`}
    >
      {children}
    </div>
  );
}
