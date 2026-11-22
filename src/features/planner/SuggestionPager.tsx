// The previous and next chevrons of the suggestion carousel with the position line between
// them. The carousel shows it above the slides on the medium and docked tiers; on compact it
// rides the pinned sheet footer beside the apply action, so paging and applying stay in thumb
// reach however far the student has scrolled the slide (ADR-0054 amendment of 2026-11-22).
// The position line is a polite live region, so a page change announces the new position, and
// its id labels the carousel's slide area. A chevron that reaches the first or last slide
// disables, so it hands focus to the other chevron beside it rather than dropping it.

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PagerArrow } from '@/components/Pager';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';

interface SuggestionPagerProps {
  page: number;
  count: number;
  onPageChange: (page: number) => void;
  /** The id of the position line, which the carousel's slide area takes as its label. */
  positionId: string;
  t: Translate;
}

export function SuggestionPager({
  page,
  count,
  onPageChange,
  positionId,
  t,
}: SuggestionPagerProps) {
  const arrowsRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<'previous' | 'next' | null>(null);
  const last = count - 1;

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === null) {
      return;
    }
    arrowsRef.current
      ?.querySelector<HTMLElement>(
        target === 'previous' ? 'button:first-of-type' : 'button:last-of-type',
      )
      ?.focus();
  }, [page]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(last, next));
    if (clamped === page) {
      return;
    }
    // The chevron that reaches an end disables, so focus moves to the other one.
    if (clamped === 0) {
      focusAfter.current = 'next';
    } else if (clamped === last) {
      focusAfter.current = 'previous';
    }
    onPageChange(clamped);
  };

  return (
    <div ref={arrowsRef} className="flex min-w-0 items-center gap-1">
      {/* The arrows carry no tooltip: the position line between them names the page, and a
          tooltip has no free side here. Above it covered the dialog close button, below the
          option heading, and toward the line, on a phone, the line itself. */}
      <PagerArrow
        label={t('suggest.prev')}
        disabled={page === 0}
        tooltip={false}
        onActivate={() => {
          go(page - 1);
        }}
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </PagerArrow>
      <p
        id={positionId}
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 text-center text-sm text-ink-soft tabular-nums"
      >
        {fillTemplate(t('suggest.position'), {
          number: page + 1,
          total: count,
        })}
      </p>
      <PagerArrow
        label={t('suggest.next')}
        disabled={page === last}
        tooltip={false}
        onActivate={() => {
          go(page + 1);
        }}
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </PagerArrow>
    </div>
  );
}
