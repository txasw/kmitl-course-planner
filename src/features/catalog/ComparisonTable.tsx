// The section comparison as a table with one row per section, the layout for a wide
// panel, and the scroller both comparison layouts sit in. The table owns its scroll on
// both axes, so its header row and its section column stay in view while a 44 section
// course scrolls under them, and the add column stays in view on the trailing edge.

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Section } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ComparisonRow } from '@/lib/catalog/compareSections';
import type { Term } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import { ComparisonAddCell } from './ComparisonAddCell';
import { HeadText } from './ComparisonFields';
import {
  ComparisonCells,
  COLUMN_HEADS,
  HEAD_CELL,
  headPinClass,
} from './SectionComparisonCells';

/** What either comparison layout renders from. */
export interface ComparisonLayoutProps {
  rows: ComparisonRow[];
  title: string;
  locale: Locale;
  t: Translate;
  /** The section whose last add was blocked, whose cell states the reason. */
  blockedId: string | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  onAdd: (section: Section) => void;
  onSwitchTerm: (term: Term) => void;
}

interface ComparisonScrollerProps {
  title: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Classes the layout adds to the scroller, such as its scroll snapping. */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ComparisonScroller({
  title,
  scrollerRef,
  className = '',
  style,
  children,
}: ComparisonScrollerProps) {
  return (
    // The scroller is a tab stop of its own, so a keyboard user can scroll it with the
    // arrow keys even when no cell holds a control, and an add or a switch that removes
    // its control hands focus to it. The browser's implicit stop for a scroller is not
    // enough: the dialog's focus trap only counts explicit stops. The ring shows where
    // focus is.
    <div
      ref={scrollerRef}
      role="region"
      aria-label={title}
      tabIndex={0}
      style={style}
      className={`kcp-scroll min-h-0 flex-1 overflow-auto rounded-kcp border border-border ${className} ${FOCUS_RING}`}
    >
      {children}
    </div>
  );
}

export function ComparisonTable({
  rows,
  title,
  locale,
  t,
  blockedId,
  scrollerRef,
  onAdd,
  onSwitchTerm,
}: ComparisonLayoutProps) {
  return (
    <ComparisonScroller title={title} scrollerRef={scrollerRef}>
      {/* Separate borders keep each cell's rule on the cell, so the rules travel with
          the sticky header and column instead of staying behind as they scroll. */}
      <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-xs">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {COLUMN_HEADS.map((head) => (
              <th
                key={head.key}
                scope="col"
                className={`${HEAD_CELL} ${head.width} ${headPinClass(head.pin)}`}
              >
                <HeadText head={head} t={t} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.section.teachTableId}>
              <ComparisonCells
                row={row}
                zebra={index % 2 === 1}
                locale={locale}
                t={t}
              />
              <ComparisonAddCell
                row={row}
                zebra={index % 2 === 1}
                pinned
                blocked={row.section.teachTableId === blockedId}
                t={t}
                onAdd={onAdd}
                onSwitchTerm={onSwitchTerm}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </ComparisonScroller>
  );
}
