// The chip row of the narrow timetable (ADR-0049). One radio group arranges the timetable: a
// week chip leads the row and shows the portrait week, and a chip per teaching day shows that
// day, so the day or week choice and the day choice are one control rather than two. Each day
// chip carries a neutral dot for a day with a class and a danger dot for a day with a time
// conflict. The dots are decoration, so each chip names its day in full and says in words
// whether it has classes or a conflict. The chosen chip reads without colour: it takes the
// heavier weight, an inset outline, and an underline bar below its label. The chips follow the
// radio group pattern: one tab stop on the chosen chip, the arrow keys move the choice around
// the whole row, week chip included, and Home and End jump to its ends. A swipe on the day
// view also changes the day, but the chips are the path that every input reaches.

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { Translate } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import {
  stepDay,
  timetableChoices,
  type DayFlag,
  type DayFlags,
  type TimetableChoice,
} from '@/lib/planner/dayView';
import { FOCUS_RING } from '@/lib/ui/focus';

interface DayChipsProps {
  days: readonly DayOfWeek[];
  /** The chosen chip: a day for the day view, or the week chip for the portrait week. */
  selected: TimetableChoice;
  flags: DayFlags;
  onSelect: (choice: TimetableChoice) => void;
  t: Translate;
}

/** The accessible name of a day chip: the full day name, then its class or conflict state. */
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

// A day chip shares the row's width with its peers, and the week chip keeps the width its
// label needs. Neither may shrink below its content, and the row wraps before it would clip.
const CHIP = `inline-flex min-h-11 min-w-(--kcp-target-min) flex-col items-center justify-center gap-1 rounded-kcp-inner px-1 text-xs transition-colors ${FOCUS_RING}`;

function chipState(isSelected: boolean): string {
  return isSelected
    ? 'bg-surface-alt font-semibold text-ink ring-1 ring-inset ring-border'
    : 'text-ink-soft hover:bg-surface-alt hover:text-ink';
}

interface ChipFaceProps {
  label: ReactNode;
  mark: ReactNode;
  isSelected: boolean;
}

/** The stacked face of a chip: its label, its mark row, and the underline bar of the chosen
 * chip, each in the flow so the bar never sits over the label. */
function ChipFace({ label, mark, isSelected }: ChipFaceProps) {
  return (
    <>
      <span aria-hidden className="whitespace-nowrap">
        {label}
      </span>
      <span aria-hidden className="flex h-3 items-center">
        {mark}
      </span>
      <span
        aria-hidden
        data-chip-bar={isSelected ? 'on' : 'off'}
        className={`h-0.5 w-4 rounded-full ${isSelected ? 'bg-ink' : 'bg-transparent'}`}
      />
    </>
  );
}

export function DayChips({
  days,
  selected,
  flags,
  onSelect,
  t,
}: DayChipsProps) {
  const chips = useRef(new Map<TimetableChoice, HTMLButtonElement>());
  const row = timetableChoices(days);

  const choose = (choice: TimetableChoice) => {
    onSelect(choice);
    chips.current.get(choice)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        choose(stepDay(row, selected, 1, true));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        choose(stepDay(row, selected, -1, true));
        break;
      case 'Home':
        event.preventDefault();
        choose(row[0] ?? selected);
        break;
      case 'End':
        event.preventDefault();
        choose(row.at(-1) ?? selected);
        break;
      default:
        break;
    }
  };

  const register = (
    choice: TimetableChoice,
    node: HTMLButtonElement | null,
  ) => {
    if (node === null) {
      chips.current.delete(choice);
    } else {
      chips.current.set(choice, node);
    }
  };

  const weekSelected = selected === 'week';

  return (
    <div
      role="radiogroup"
      aria-label={t('view.dayPicker')}
      className="flex shrink-0 flex-wrap gap-0.5 rounded-kcp border border-border p-1"
    >
      <button
        ref={(node) => {
          register('week', node);
        }}
        type="button"
        role="radio"
        aria-checked={weekSelected}
        aria-label={t('view.weekChip')}
        tabIndex={weekSelected ? 0 : -1}
        data-day="week"
        onKeyDown={handleKeyDown}
        onClick={() => {
          onSelect('week');
        }}
        className={`${CHIP} flex-none px-2 ${chipState(weekSelected)}`}
      >
        <ChipFace
          label={t('view.weekChip')}
          mark={<CalendarDays size={12} strokeWidth={2} />}
          isSelected={weekSelected}
        />
      </button>
      {days.map((day) => {
        const isSelected = day === selected;
        const flag = flags[day];
        return (
          <button
            key={day}
            ref={(node) => {
              register(day, node);
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
            className={`${CHIP} flex-1 ${chipState(isSelected)}`}
          >
            <ChipFace
              label={t(dayLabelKey(day))}
              mark={
                <span
                  aria-hidden
                  data-day-dot={
                    flag.hasConflict
                      ? 'conflict'
                      : flag.hasClass
                        ? 'class'
                        : 'none'
                  }
                  className={`size-1 rounded-full ${dotClass(flag)}`}
                />
              }
              isSelected={isSelected}
            />
          </button>
        );
      })}
    </div>
  );
}
