// A two or more option segmented control. Each option is a button and the active
// one is marked with aria-pressed, so the selected state is conveyed without
// relying on color. The active option takes the alternate surface, ink text, and the
// semibold weight, so a bar never shows two orange blocks side by side and a dialog
// keeps its orange for its primary action. Labels never wrap, and every option keeps
// the shared target size.

import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

const ACTIVE = 'bg-surface-alt font-semibold text-ink';

const INACTIVE = 'text-ink-soft hover:text-ink';

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-kcp border border-border p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(option.value);
            }}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-kcp-inner px-2 py-1 text-xs transition-colors ${TARGET_SIZE} ${FOCUS_RING} ${
              active ? ACTIVE : INACTIVE
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
