// A two or more option segmented control. Each option is a button and the active
// one is marked with aria-pressed, so the selected state is conveyed without
// relying on color. Two looks share the behavior. The filled variant fills the
// active option with the strong brand orange and is kept for the view mode choice,
// the one header control whose state changes the whole panel. The quiet variant
// marks the active option with the alternate surface, ink text, and the semibold
// weight, for settings such as the language, so the header never shows two orange
// blocks side by side. Labels never wrap, and every option keeps the shared target
// size. An option may carry an icon: below 640 px the option then shows the icon alone
// in a square segment and keeps its label as sr-only text, so its accessible name is
// the same word the wider layout shows.

import type { LucideIcon } from 'lucide-react';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export type SegmentedVariant = 'filled' | 'quiet';

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  variant?: SegmentedVariant;
}

const ACTIVE: Record<SegmentedVariant, string> = {
  filled: 'bg-primary-strong text-white',
  quiet: 'bg-surface-alt font-semibold text-ink',
};

const INACTIVE = 'text-ink-soft hover:text-ink';

// An inset ring on the orange fill would fall under the 3:1 bar, so the filled variant
// keeps the offset outline of ADR-0034 and the quiet one the default inset ring.
const FOCUS: Record<SegmentedVariant, string> = {
  filled: FOCUS_OUTLINE,
  quiet: FOCUS_RING,
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  variant = 'filled',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-kcp border border-border p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(option.value);
            }}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-[6px] px-2.5 py-1 text-xs transition-colors ${
              Icon === undefined ? '' : 'max-sm:size-8 max-sm:p-0'
            } ${TARGET_SIZE} ${FOCUS[variant]} ${
              active ? ACTIVE[variant] : INACTIVE
            }`}
          >
            {Icon === undefined ? (
              option.label
            ) : (
              <>
                <Icon
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className="sm:hidden"
                />
                <span className="max-sm:sr-only">{option.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
