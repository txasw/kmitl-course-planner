// A hover detail card for a placed block. After a short delay the grid opens this card on
// the hovered block, so a look at the full detail set needs no click; a click or Enter or
// Space on the block still opens the pinned detail popover for actions, and the card never
// spawns while that popover is pinned (ADR-0044). It reads the same plan entry snapshot the
// popover reads, so no new data is plumbed. It is read only, with no actions, and positioned
// to the side so it never sits under the pointer or over the block's remove control. Like
// the shared Tooltip it meets WCAG 1.4.13 hoverable: the grid opens it, and it then owns its
// own dismissal through floating-ui's safePolygon, so the pointer can travel from the block
// onto the card to read or select a long field, and the card closes once the pointer leaves
// both. It shares a family look with the drag conflict card but carries a neutral
// info accent, a left border in the brand, so a placed block and a blocked drop read
// differently at a glance. Its body is the compact SectionDetailList, the same list the
// popover renders in full, so the two surfaces never disagree on a field.

import { useCallback, useEffect } from 'react';
import {
  FloatingPortal,
  safePolygon,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import { useStore } from 'zustand';
import type { Locale, Translate } from '@/lib/i18n/t';
import { snapshotToSection } from '@/lib/domain/plan';
import { planStore } from '@/features/plans/planStore';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { SectionDetailList } from './SectionDetailList';
import type { ExamOverlap } from '@/lib/planner/examOverlap';

interface BlockHoverCardProps {
  teachTableId: string;
  anchor: HTMLElement;
  locale: Locale;
  t: Translate;
  examOverlaps: ExamOverlap[];
  /** Dismiss the card, on Escape or once the pointer has left both the block and the card. */
  onClose: () => void;
}

export function BlockHoverCard({
  teachTableId,
  anchor,
  locale,
  t,
  examOverlaps,
  onClose,
}: BlockHoverCardProps) {
  const entries = useStore(planStore, (state) => state.entries);
  const portalRoot = usePanelPortal();
  const entry = entries.find((item) => item.teachTableId === teachTableId);

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 8,
    ambient: true,
    open: true,
    onOpenChange: (next) => {
      if (!next) {
        onClose();
      }
    },
    placement: 'right-start',
    elements: { reference: anchor },
  });
  // The grid already waited out the open delay, so only the close path is used here.
  const hover = useHover(context, {
    move: false,
    handleClose: safePolygon(),
  });
  const { getFloatingProps } = useInteractions([hover]);
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  // A section removed under the pointer, through the block's own remove control, takes its
  // block away without a mouse leave, so close here. A card left open would otherwise come
  // back on undo, anchored to the detached block and taking the pointer where it lands.
  useEffect(() => {
    if (entry === undefined) {
      onClose();
    }
  }, [entry, onClose]);

  // Escape dismisses the card without closing the overlay, matched to the popover guard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  if (entry === undefined) {
    return null;
  }
  const snapshot = entry.snapshot;
  const name =
    locale === 'th' ? snapshot.subjectMeta.nameTh : snapshot.subjectMeta.nameEn;
  const badge = blockBadge(entry.verifyStatus, false, examOverlaps.length > 0);
  const badgeText = blockBadgeLabelKeys(
    entry.verifyStatus,
    false,
    examOverlaps.length > 0,
  )
    .map((key) => t(key))
    .join(' ');

  const card = (
    <div
      ref={setFloating}
      style={floatingStyles}
      {...getFloatingProps()}
      role="tooltip"
      className={`z-popover flex w-72 ${PANEL_POPOVER_SCROLL} flex-col gap-1 rounded-kcp border border-l-2 border-border border-l-primary bg-surface p-2.5 text-xs shadow-kcp`}
    >
      <p className="font-semibold text-ink">
        <span>{snapshot.subjectId}</span> <span lang={locale}>{name}</span>
      </p>
      <p className="text-ink-soft">
        {t('section.code')} {snapshot.section}
      </p>
      <div className="mt-1 border-t border-border pt-1.5">
        <SectionDetailList
          section={snapshotToSection(snapshot)}
          creditStr={snapshot.subjectMeta.creditStr}
          density="compact"
          locale={locale}
          t={t}
        />
      </div>
      {badge !== null && badgeText !== '' ? (
        <p
          className={`font-semibold ${badge === 'danger' ? 'text-danger' : 'text-warn'}`}
        >
          {badgeText}
        </p>
      ) : null}
    </div>
  );

  return portalRoot === null ? (
    card
  ) : (
    <FloatingPortal root={portalRoot}>{card}</FloatingPortal>
  );
}
