// The detail surface of a placed block, edit mode only. It shows the section's full
// metadata through the full SectionDetailList, the same list the hover card renders
// compact, so the surface that touch and keyboard users reach carries every meeting, the
// seats from the latest verification, and the exam dates. Above the list sit its
// verification state with old versus new values for a changed field and any exam overlap,
// and a pinned footer carries the acknowledge and remove actions.
//
// It picks its form from the pointer as well as the width (ADR-0049). On a fine pointer at
// 640 px and up it is a popover anchored to the block. Below 640 px there is no room beside
// the block, and on a coarse pointer a finger needs 44 px targets and a surface it cannot
// knock aside, so both open the same content in a bottom sheet. Either form lands focus on
// its heading, and closing returns focus to the block. Preview blocks accept no
// interaction (section 6.4), so the surface renders nothing there.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import {
  BREAKPOINTS,
  COARSE_POINTER_QUERY,
  minWidthQuery,
} from '@/lib/ui/breakpoints';
import { BottomSheet } from '@/components/BottomSheet';
import { planStore } from '@/features/plans/planStore';
import { useActiveRun } from '@/features/plans/revalidationStore';
import { activeElementWithin } from '@/features/shell/useFocusTrap';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { uiStore } from '@/features/shell/uiStore';
import { BlockDetailActions, BlockDetailBody } from './BlockDetailContent';
import { BlockDetailPopover } from './BlockDetailPopover';

interface BlockDetailSurfaceProps {
  teachTableId: string;
  /** The block that opened the surface; the popover anchors to it and focus returns to it. */
  anchor: HTMLElement;
  locale: Locale;
  t: Translate;
  onClose: () => void;
  onRemove: (teachTableId: string) => void;
  /** Exam window overlaps this block has with other entries, listed as a distinct
   * section so the reason reads apart from a revalidation change. */
  examOverlaps?: ExamOverlap[];
}

export function BlockDetailSurface({
  teachTableId,
  anchor,
  locale,
  t,
  onClose,
  onRemove,
  examOverlaps = [],
}: BlockDetailSurfaceProps) {
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const entries = useStore(planStore, (state) => state.entries);
  const run = useActiveRun();
  const wide = useMediaQuery(minWidthQuery(BREAKPOINTS.sm));
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  const anchored = wide && !coarse;

  const entry = entries.find((item) => item.teachTableId === teachTableId);

  // Close if the entry left the plan while the surface was open.
  useEffect(() => {
    if (entry === undefined) {
      onClose();
    }
  }, [entry, onClose]);

  useReturnFocus(anchor);

  if (viewMode !== 'edit' || entry === undefined) {
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
    <BlockDetailPopover
      anchor={anchor}
      title={code}
      subtitle={<span lang={locale}>{name}</span>}
      closeLabel={t('action.close')}
      onClose={onClose}
      footer={actions}
    >
      {body}
    </BlockDetailPopover>
  );
}

// Returns focus to the block when the surface closes, whichever way it closed. It acts only
// when focus was lost with the surface, which is the case after the close button, Escape,
// or an action inside it; an outside click that moved focus to another control keeps it
// there. A block the remove action took out of the grid is no longer connected and is
// skipped.
function useReturnFocus(anchor: HTMLElement): void {
  useEffect(
    () => () => {
      if (!anchor.isConnected) return;
      const active = activeElementWithin(anchor);
      if (active === null || active === anchor.ownerDocument.body) {
        anchor.focus();
      }
    },
    [anchor],
  );
}
