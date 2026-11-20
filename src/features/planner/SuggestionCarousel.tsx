// The suggestion cards of the suggestion dialog as a carousel, one card per slide on every
// tier, so each suggestion takes the full width of the dialog and its grid is large enough
// to read without a separate full size view. The slides sit on one track that slides by the
// shown page, and only the shown slide takes focus or reaches assistive technology; the
// others are inert. Paging runs four ways: a swipe across the slide, the previous and next
// chevrons, a dot per suggestion, and the left and right arrow keys, with Home and End, on
// the focusable slide area, the shown slide's controls included, and on the dots. The
// position line between the chevrons is a polite live region, so a change announces the
// new position. A single suggestion shows no paging at all. Under reduced motion the track
// jumps instead of sliding and the slide does not follow the finger, while the swipe itself
// still pages.
//
// A press keeps its own target: the swipe starts only once the pointer has travelled past a
// slop, so a tap on the apply action or the left out list is never taken by the gesture. A
// page change from a key inside the outgoing slide moves focus to the carousel, since that
// slide turns inert under the focused control; a key on a dot moves focus to the new dot.
//
// Each slide keeps a few px of padding inside the clipping viewport. The viewport's inset
// focus ring paints in that gap, where the card and the moving track would cover it, and a
// control at the slide edge, the full width apply button on a phone, keeps its offset
// outline inside the clip.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PagerArrow } from '@/components/Pager';
import { Tooltip } from '@/components/Tooltip';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { Suggestion } from '@/lib/planner/suggest';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_TOUCH } from '@/lib/ui/target';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import { useSwipeGesture } from '@/features/shell/useSwipeGesture';
import type { Orientation } from './gridGeometry';
import type { PlacedSection } from './placedSection';
import { SuggestionCard } from './SuggestionCard';
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

/** The distance a pointer travels before the swipe takes it, as the day view swipe does. */
const SWIPE_SLOP_PX = 24;

type FocusAfter = 'dot' | 'viewport' | null;

interface SuggestionCarouselProps {
  cards: readonly SuggestionView[];
  frame: SuggestionFrame;
  orientation: Orientation;
  /** The slide shown. */
  page: number;
  onPageChange: (page: number) => void;
  busy: boolean;
  locale: Locale;
  t: Translate;
  onApply: (suggestion: Suggestion) => void;
}

/** The element that holds focus in the tree of a node, inside a shadow root included. */
function activeIn(node: Node | null): Element | null {
  const root = node?.getRootNode();
  return root instanceof ShadowRoot || root instanceof Document
    ? root.activeElement
    : null;
}

function keyTarget(key: string, page: number, last: number): number | null {
  switch (key) {
    case 'ArrowLeft':
      return page - 1;
    case 'ArrowRight':
      return page + 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

function CarouselDots({
  count,
  page,
  onSelect,
  label,
  itemLabel,
  dotsRef,
  onKeyDown,
}: {
  count: number;
  page: number;
  onSelect: (index: number) => void;
  label: string;
  itemLabel: (index: number) => string;
  dotsRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <div
      ref={dotsRef}
      role="group"
      aria-label={label}
      className="flex items-center justify-center"
    >
      {Array.from({ length: count }, (_, index) => {
        const current = index === page;
        const name = itemLabel(index);
        return (
          <Tooltip key={name} label={name}>
            {(triggerProps, ref) => (
              <button
                ref={ref}
                {...triggerProps}
                type="button"
                aria-label={name}
                aria-current={current ? 'true' : undefined}
                data-suggest-dot={index}
                onKeyDown={onKeyDown}
                onClick={() => {
                  onSelect(index);
                }}
                className={`group/dot inline-flex items-center justify-center rounded-full ${TARGET_TOUCH} ${FOCUS_RING}`}
              >
                <span
                  aria-hidden
                  className={`block h-1.5 rounded-full transition-[width,background-color] duration-base motion-reduce:transition-none ${
                    current
                      ? 'w-4 bg-ink'
                      : 'w-1.5 bg-border-strong group-hover/dot:bg-ink-soft'
                  }`}
                />
              </button>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}

export function SuggestionCarousel({
  cards,
  frame,
  orientation,
  page,
  onPageChange,
  busy,
  locale,
  t,
  onApply,
}: SuggestionCarouselProps) {
  const positionId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<FocusAfter>(null);
  const last = cards.length - 1;
  const paged = cards.length > 1;

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === 'dot') {
      dotsRef.current
        ?.querySelector<HTMLElement>(`[data-suggest-dot="${String(page)}"]`)
        ?.focus();
    } else if (target === 'viewport') {
      viewportRef.current?.focus();
    }
  }, [page]);

  const go = (next: number, focus: FocusAfter) => {
    const clamped = Math.max(0, Math.min(last, next));
    if (clamped === page) {
      return;
    }
    // A control in the outgoing slide turns inert, so focus moves out of it rather than
    // dropping to the document.
    const held = activeIn(trackRef.current);
    const inSlide = held !== null && trackRef.current?.contains(held) === true;
    focusAfter.current = focus ?? (inSlide ? 'viewport' : null);
    onPageChange(clamped);
  };

  // A finger that travels left brings the next suggestion in from the right.
  const swipe = useSwipeGesture({
    axis: 'x',
    slop: SWIPE_SLOP_PX,
    enabled: paged,
    onSwipe: (direction) => {
      go(page - direction, null);
    },
  });

  // A stable ref, so a render during the swipe keeps the claim attached; a fresh callback
  // each render would detach it and drop the touch it is tracking.
  const { bindClaim } = swipe;
  const bindViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      return bindClaim(node);
    },
    [bindClaim],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const next = keyTarget(event.key, page, last);
    if (next === null || !paged) {
      return;
    }
    event.preventDefault();
    const onDot =
      event.target instanceof Node &&
      dotsRef.current?.contains(event.target) === true;
    go(next, onDot ? 'dot' : null);
  };

  const position = fillTemplate(t('suggest.position'), {
    number: page + 1,
    total: cards.length,
  });

  return (
    <div
      className={`flex flex-col gap-2 transition-opacity duration-base motion-reduce:transition-none ${busy ? 'opacity-60' : ''}`}
    >
      {paged ? (
        <div className="flex items-center gap-1">
          <PagerArrow
            label={t('suggest.prev')}
            disabled={page === 0}
            onActivate={() => {
              go(page - 1, page - 1 === 0 ? 'dot' : null);
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
            {position}
          </p>
          <PagerArrow
            label={t('suggest.next')}
            disabled={page === last}
            onActivate={() => {
              go(page + 1, page + 1 === last ? 'dot' : null);
            }}
          >
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </PagerArrow>
        </div>
      ) : null}
      <div
        ref={bindViewport}
        {...swipe.handlers}
        onKeyDown={handleKeyDown}
        role={paged ? 'group' : undefined}
        aria-labelledby={paged ? positionId : undefined}
        tabIndex={paged ? 0 : undefined}
        className={`overflow-hidden rounded-kcp select-none ${swipe.touchClass} ${paged ? FOCUS_RING : ''}`}
      >
        <div style={reducedMotion ? undefined : swipe.style}>
          <div
            ref={trackRef}
            className="flex items-start transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${String(-page * 100)}%)` }}
          >
            {cards.map((card, index) => (
              <div
                key={suggestionKey(card.suggestion)}
                data-suggest-slide={index}
                inert={index !== page}
                className="w-full min-w-0 shrink-0 p-1"
              >
                <SuggestionCard
                  suggestion={card.suggestion}
                  index={index}
                  sections={card.sections}
                  frame={frame}
                  orientation={orientation}
                  locale={locale}
                  t={t}
                  onApply={() => {
                    onApply(card.suggestion);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {paged ? (
        <CarouselDots
          count={cards.length}
          page={page}
          onSelect={(index) => {
            go(index, null);
          }}
          label={t('suggest.pager')}
          itemLabel={(index) =>
            fillTemplate(t('suggest.option'), { number: index + 1 })
          }
          dotsRef={dotsRef}
          onKeyDown={handleKeyDown}
        />
      ) : null}
    </div>
  );
}
