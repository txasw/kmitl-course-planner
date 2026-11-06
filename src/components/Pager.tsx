// The paging controls first built for the export template gallery (ADR-0045) and shared
// with the compact plan suggestion pager: a previous and next arrow pair and a dot
// radiogroup for direct jumps. usePager holds the paging rule both consumers follow. A
// move clamps at the first and last page rather than wrapping, and it lands focus on the
// selected dot, so a keyboard user who pages from an arrow that then disables keeps a
// focused control. The dots take the arrow keys, Home, and End through the hook's key
// handler; each dot stays small while its button keeps the shared target size.

import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Tooltip } from '@/components/Tooltip';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface PagerOptions {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}

export interface Pager {
  /** Page by a signed step, clamped to the range, and focus the selected dot. */
  move: (delta: number) => void;
  /** The key handler for the dots: the arrow keys page, Home and End jump. */
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** The ref the dot radiogroup takes, so a move can focus its selected dot. */
  groupRef: RefObject<HTMLDivElement | null>;
}

export function usePager({ count, selected, onSelect }: PagerOptions): Pager {
  const groupRef = useRef<HTMLDivElement>(null);
  const last = count - 1;

  const move = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(last, selected + delta));
      if (next !== selected) {
        onSelect(next);
      }
      groupRef.current
        ?.querySelectorAll<HTMLElement>('[role="radio"]')
        [next]?.focus();
    },
    [last, selected, onSelect],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const delta: Partial<Record<string, number>> = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1,
        Home: -selected,
        End: last - selected,
      };
      const step = delta[event.key];
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      move(step);
    },
    [move, selected, last],
  );

  return { move, handleKeyDown, groupRef };
}

export function PagerArrow({
  label,
  disabled,
  onActivate,
  children,
}: {
  label: string;
  disabled: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onActivate}
          className={`flex shrink-0 items-center justify-center rounded-kcp border border-border p-1 text-ink-soft transition-colors hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-30 ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}

interface PagerDotsProps {
  /** The pager's group ref, so a move can focus the selected dot. */
  groupRef: RefObject<HTMLDivElement | null>;
  /** The pager's key handler. */
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** The accessible name of the radiogroup, already localized. */
  label: string;
  /** The accessible name and tooltip of each dot, one per page, already localized. */
  itemLabels: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
}

export function PagerDots({
  groupRef,
  onKeyDown,
  label,
  itemLabels,
  selected,
  onSelect,
}: PagerDotsProps) {
  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className="flex items-center justify-center"
    >
      {itemLabels.map((itemLabel, index) => {
        const isSelected = index === selected;
        return (
          <Tooltip key={itemLabel} label={itemLabel}>
            {(triggerProps, ref) => (
              <button
                ref={ref}
                {...triggerProps}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={itemLabel}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={onKeyDown}
                onClick={() => {
                  onSelect(index);
                }}
                className={`group/dot inline-flex items-center justify-center rounded-full ${TARGET_SIZE} ${FOCUS_RING}`}
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-transparent group-hover/dot:border-ink-soft'
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
