// The day picker of the narrow timetable (ADR-0049). A radio group of day chips keeps the
// shape of the week in view while the timetable below shows one day: each chip carries a
// neutral dot for a day with a class and a danger dot for a day with a time conflict. The
// dots are decoration, so each chip names its day in full and says in words whether it has
// classes or a conflict. The chips follow the radio group pattern: one tab stop on the
// chosen chip, the arrow keys move the choice around the row, and Home and End jump to its
// ends. A swipe on the timetable also changes the day, but the chips are the path that
// every input reaches.

import { useRef, type KeyboardEvent } from 'react';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { Translate } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { stepDay, type DayFlag, type DayFlags } from '@/lib/planner/dayView';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface DayChipsProps {
  days: readonly DayOfWeek[];
  selected: DayOfWeek;
  flags: DayFlags;
  onSelect: (day: DayOfWeek) => void;
  t: Translate;
}

/** The accessible name of a chip: the full day name, then its class or conflict state. */
function chipName(day: DayOfWeek, flag: DayFlag, t: Translate): string {
  const name = t(dayFullLabelKey(day));
  if (flag.hasConflict) {
    return `${name} ${t('view.dayHasConflict')}`;
  }
  return flag.hasClass ? `${name} ${t('view.dayHasClasses')}` : name;
}

function dotClass(flag: DayFlag): string {
  if (flag.hasConflict) {
    return 'bg-danger';
  }
  return flag.hasClass ? 'bg-ink-soft' : 'bg-transparent';
}

export function DayChips({
  days,
  selected,
  flags,
  onSelect,
  t,
}: DayChipsProps) {
  const chips = useRef(new Map<DayOfWeek, HTMLButtonElement>());

  const choose = (day: DayOfWeek) => {
    onSelect(day);
    chips.current.get(day)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        choose(stepDay(days, selected, 1, true));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        choose(stepDay(days, selected, -1, true));
        break;
      case 'Home':
        event.preventDefault();
        choose(days[0] ?? selected);
        break;
      case 'End':
        event.preventDefault();
        choose(days.at(-1) ?? selected);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('view.dayPicker')}
      className="flex shrink-0 gap-0.5 rounded-kcp border border-border p-0.5"
    >
      {days.map((day) => {
        const isSelected = day === selected;
        const flag = flags[day];
        return (
          <button
            key={day}
            ref={(node) => {
              if (node === null) {
                chips.current.delete(day);
              } else {
                chips.current.set(day, node);
              }
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={chipName(day, flag, t)}
            tabIndex={isSelected ? 0 : -1}
            data-day={day}
            onKeyDown={handleKeyDown}
            onClick={() => {
              onSelect(day);
            }}
            className={`inline-flex min-h-9 flex-1 flex-col items-center justify-center gap-0.5 rounded-[6px] text-xs transition-colors ${TARGET_SIZE} ${FOCUS_RING} ${
              isSelected
                ? 'bg-surface-alt font-semibold text-ink'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <span aria-hidden>{t(dayLabelKey(day))}</span>
            <span
              aria-hidden
              data-day-dot={
                flag.hasConflict ? 'conflict' : flag.hasClass ? 'class' : 'none'
              }
              className={`size-1 rounded-full ${dotClass(flag)}`}
            />
          </button>
        );
      })}
    </div>
  );
}
