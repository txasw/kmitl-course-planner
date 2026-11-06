// The suggestion cards of the suggestion dialog, laid out for comparison. On the medium
// and docked tiers the cards sit side by side on one grid whose rows the cards share
// through a subgrid, so each stat lines up across the cards. On compact a phone has room
// for one card, so the cards become a horizontal pager: one card at a time, a swipe across
// its grid, and the arrows and the dot radiogroup of the template gallery below it.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PagerArrow, PagerDots, usePager } from '@/components/Pager';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { Suggestion } from '@/lib/planner/suggest';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import { useSwipeGesture } from '@/features/shell/useSwipeGesture';
import type { Orientation } from './gridGeometry';
import type { PlacedSection } from './placedSection';
import { SUBGRID_CARD, SuggestionCard } from './SuggestionCard';
import type { SuggestionFrame } from './suggestionFrame';

export interface SuggestionView {
  suggestion: Suggestion;
  sections: readonly PlacedSection[];
}

/** A stable key for a suggestion: the sections it chooses. */
export function suggestionKey(suggestion: Suggestion): string {
  return suggestion.choices
    .map((choice) => choice.section.teachTableId)
    .join(',');
}

interface SuggestionResultsProps {
  cards: readonly SuggestionView[];
  frame: SuggestionFrame;
  /** The pager on compact, the side by side list otherwise. */
  paged: boolean;
  orientation: Orientation;
  /** The card the pager shows. */
  page: number;
  onPageChange: (page: number) => void;
  busy: boolean;
  locale: Locale;
  t: Translate;
  onApply: (suggestion: Suggestion) => void;
}

function CompactPager({
  cards,
  frame,
  orientation,
  page,
  onPageChange,
  locale,
  t,
  onApply,
}: Omit<SuggestionResultsProps, 'paged' | 'busy'>) {
  const reducedMotion = usePrefersReducedMotion();
  const last = cards.length - 1;
  const { move, groupRef, handleKeyDown } = usePager({
    count: cards.length,
    selected: page,
    onSelect: onPageChange,
  });
  // A swipe pages without moving focus, the way the gallery swipe does, so the sheet does
  // not scroll to the dots under a finger. A left swipe brings the next card.
  const swipe = useSwipeGesture({
    axis: 'x',
    onSwipe: (direction) => {
      onPageChange(Math.max(0, Math.min(last, page - direction)));
    },
    enabled: !reducedMotion,
  });
  const card = cards[page];
  if (card === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <SuggestionCard
        key={suggestionKey(card.suggestion)}
        suggestion={card.suggestion}
        index={page}
        sections={card.sections}
        frame={frame}
        orientation={orientation}
        locale={locale}
        t={t}
        swipe={swipe}
        onApply={() => {
          onApply(card.suggestion);
        }}
      />
      {cards.length > 1 ? (
        <div className="flex items-center justify-center gap-1">
          <PagerArrow
            label={t('suggest.prev')}
            disabled={page === 0}
            onActivate={() => {
              move(-1);
            }}
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </PagerArrow>
          <PagerDots
            groupRef={groupRef}
            onKeyDown={handleKeyDown}
            label={t('suggest.pager')}
            itemLabels={cards.map((_, index) =>
              fillTemplate(t('suggest.option'), { number: index + 1 }),
            )}
            selected={page}
            onSelect={onPageChange}
          />
          <PagerArrow
            label={t('suggest.next')}
            disabled={page === last}
            onActivate={() => {
              move(1);
            }}
          >
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </PagerArrow>
        </div>
      ) : null}
    </div>
  );
}

export function SuggestionResults(props: SuggestionResultsProps) {
  const { cards, frame, paged, orientation, busy, locale, t, onApply } = props;
  const dim = `transition-opacity duration-base motion-reduce:transition-none ${busy ? 'opacity-60' : ''}`;
  if (paged) {
    return (
      <div className={dim}>
        <CompactPager {...props} />
      </div>
    );
  }
  return (
    <ol
      className={`grid gap-3 ${dim}`}
      style={{
        gridTemplateColumns: `repeat(${String(cards.length)}, minmax(0, 1fr))`,
      }}
    >
      {cards.map((card, index) => (
        <li key={suggestionKey(card.suggestion)} className={SUBGRID_CARD}>
          <SuggestionCard
            suggestion={card.suggestion}
            index={index}
            sections={card.sections}
            frame={frame}
            orientation={orientation}
            subgrid
            locale={locale}
            t={t}
            onApply={() => {
              onApply(card.suggestion);
            }}
          />
        </li>
      ))}
    </ol>
  );
}
