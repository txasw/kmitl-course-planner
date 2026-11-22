// The suggestion cards of the suggestion dialog as a carousel, one card per slide on every
// tier, so each suggestion takes the full width of the dialog and its grid is large enough
// to read without a separate full size view. The slides sit on one track that slides by the
// shown page, and only the shown slide takes focus or reaches assistive technology; the
// others are inert. Paging runs four ways: a swipe across the slide, the previous and next
// chevrons of the suggestion pager, a dot per suggestion, and the left and right arrow keys,
// with Home and End, on the focusable slide area, the shown slide's controls included, and on
// the dots. The pager sits above the slides, or, where the dialog pins it to the sheet footer
// with the apply action on compact, outside the carousel, which then leaves out the pager and
// each slide's own apply action and takes the pager's position line as its label. The slide
// area and each slide carry the carousel and slide role descriptions, localized, so assistive
// technology names the pattern. A single suggestion shows no paging at all. Under reduced motion the track
// jumps instead of sliding and the track does not follow the finger, while the swipe itself
// still pages.
//
// A press keeps its own target: the swipe starts only once the pointer has travelled past a
// slop, so a tap on the apply action or the left out list is never taken by the gesture. A
// page change from a key inside the outgoing slide moves focus to the carousel, since that
// slide turns inert under the focused control; a key on a dot moves focus to the new dot.
// Only the shown dot is a tab stop, and the keys move between the dots, as in the mockup.
//
// Each slide keeps 4 px of padding inside the clipping viewport. The viewport's inset focus
// ring paints in that gap, where the card and the moving track would cover it, and a control
// near the slide edge keeps its offset outline inside the clip. A portrait slide pads only
// above and below, since its day columns need the width for a Thai word at 360 px; its
// heading row, which holds the apply action, insets itself instead.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
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
import { SuggestionPager } from './SuggestionPager';

export interface SuggestionView {
  suggestion: Suggestion;
  sections: readonly PlacedSection[];
  /** The plan's section codes of each subject the suggestion moves, by subject id. */
  movedFrom: ReadonlyMap<string, string>;
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
  /** The id of the pager's position line, set when the pager and the apply action ride a
   * footer outside the carousel, so the carousel shows neither and labels its slide area by
   * that line. Unset, the carousel shows the pager above the slides and an apply action in
   * each slide. */
  externalPagerId?: string | undefined;
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

/** The track at the shown page. A drag moves the track itself with no fade, resisted past
 * either end, so a release slides on from where the finger let go rather than snapping
 * back first; the drag turns the transition off and the release turns it on again. */
function trackStyle(page: number, last: number, offset: number): CSSProperties {
  const at = `${String(-page * 100)}%`;
  if (offset === 0) {
    return { transform: `translateX(${at})` };
  }
  const pastEnd = (page === 0 && offset > 0) || (page === last && offset < 0);
  const pull = pastEnd ? offset / 3 : offset;
  return {
    transform: `translateX(calc(${at} + ${String(pull)}px))`,
    transition: 'none',
  };
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
                tabIndex={current ? 0 : -1}
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
  externalPagerId,
}: SuggestionCarouselProps) {
  const ownPositionId = useId();
  const positionId = externalPagerId ?? ownPositionId;
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

  return (
    <div
      className={`flex flex-col gap-2 transition-opacity duration-base motion-reduce:transition-none ${busy ? 'opacity-60' : ''}`}
    >
      {paged && externalPagerId === undefined ? (
        <SuggestionPager
          page={page}
          count={cards.length}
          onPageChange={(next) => {
            go(next, null);
          }}
          positionId={positionId}
          t={t}
        />
      ) : null}
      <div
        ref={bindViewport}
        {...swipe.handlers}
        onKeyDown={handleKeyDown}
        role={paged ? 'group' : undefined}
        aria-roledescription={paged ? t('suggest.carousel') : undefined}
        aria-labelledby={paged ? positionId : undefined}
        tabIndex={paged ? 0 : undefined}
        className={`overflow-hidden rounded-kcp select-none ${swipe.touchClass} ${paged ? FOCUS_RING : ''}`}
      >
        <div
          ref={trackRef}
          className="flex items-start transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
          style={trackStyle(page, last, reducedMotion ? 0 : swipe.offset)}
        >
          {cards.map((card, index) => (
            <div
              key={suggestionKey(card.suggestion)}
              data-suggest-slide={index}
              inert={index !== page}
              className={`w-full min-w-0 shrink-0 ${orientation === 'portrait' ? 'py-1' : 'p-1'}`}
            >
              <SuggestionCard
                suggestion={card.suggestion}
                index={index}
                sections={card.sections}
                movedFrom={card.movedFrom}
                frame={frame}
                orientation={orientation}
                roleDescription={paged ? t('suggest.slide') : undefined}
                locale={locale}
                t={t}
                onApply={
                  externalPagerId === undefined
                    ? () => {
                        onApply(card.suggestion);
                      }
                    : undefined
                }
              />
            </div>
          ))}
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
