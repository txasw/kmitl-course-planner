// The detail surface of a placed block, edit mode only. It shows the section's full
// metadata through the full SectionDetailList, the same list the hover card renders
// compact, so the surface that touch and keyboard users reach carries every meeting, the
// seats from the latest verification, and the exam dates. Above the list sit its
// verification state with old versus new values for a changed field and any exam overlap,
// and a pinned footer carries the acknowledge and remove actions. The body ends with a link
// to the subject's listing on the host's own result page, opened in a new tab so the plan
// stays where it is; following a link is the only contact with the host (section 2, rule 6).
//
// It picks its form from the pointer as well as the width (ADR-0049). On a fine pointer at
// 640 px and up it is a popover anchored to the block. Below 640 px there is no room beside
// the block, and on a coarse pointer a finger needs 44 px targets and a surface it cannot
// knock aside, so both open the same content in a bottom sheet. Either form lands focus on
// its heading, and closing returns focus to the block. Preview blocks accept no
// interaction (section 6.4), so the surface renders nothing there.

import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useStore } from 'zustand';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import { termFromSourceQueryParams } from '@/lib/planner/sourceQuery';
import { subjectListingUrl } from '@/lib/routing/teachTableUrl';
import {
  BREAKPOINTS,
  COARSE_POINTER_QUERY,
  minWidthQuery,
} from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { BottomSheet } from '@/components/BottomSheet';
import { planStore } from '@/features/plans/planStore';
import { useActiveRun } from '@/features/plans/revalidationStore';
import { useReturnFocus } from '@/features/shell/restoreFocus';
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

interface OfficialListingLinkProps {
  entry: PlanEntry;
  t: Translate;
  /** Size the link as a 44 px touch target, for the sheet. */
  touch: boolean;
}

/**
 * A link to the subject's listing on the host result page for the term the entry was
 * added from, or nothing when that term or the subject id cannot form one.
 */
function OfficialListingLink({ entry, t, touch }: OfficialListingLinkProps) {
  const term = termFromSourceQueryParams(entry.sourceQuery.params);
  const href = term === null ? null : subjectListingUrl(term, entry.subjectId);
  if (href === null) {
    return null;
  }
  const label = t('block.officialListing');
  const size = touch ? 'min-h-11 text-sm' : TARGET_SIZE;
  // The name carries the visible label first, so speech input still finds it by what it
  // shows, and then says that it leaves the panel for a new tab.
  return (
    <p className="mt-2 border-t border-border pt-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} ${t('block.opensNewTab')}`}
        className={`inline-flex items-center gap-1 rounded-kcp px-1 text-primary-strong underline underline-offset-2 ${size} ${FOCUS_RING}`}
      >
        <ExternalLink size={touch ? 16 : 12} aria-hidden />
        {label}
      </a>
    </p>
  );
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
    <>
      <BlockDetailBody
        entry={entry}
        diff={run?.report?.entries.find(
          (item) => item.teachTableId === teachTableId,
        )}
        examOverlaps={examOverlaps}
        locale={locale}
        t={t}
      />
      <OfficialListingLink entry={entry} t={t} touch={!anchored} />
    </>
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
