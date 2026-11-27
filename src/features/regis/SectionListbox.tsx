// The section menu of a subject on the helper card: a custom listbox, never a native
// select, opened from the section tile or from Other section. It lists the planned group
// first, then the kit's other groups, each with the one worst fact the kit knew at
// prepare time: closed, full, a class or exam clash, or a fit. Choosing a group makes it
// the one this registration uses; the plan changes only through its own save. Focus stays
// on the trigger, a select only combobox that names the active option, so the keys move
// through the options without leaving it; a closed group, or one the page turned down in
// this visit, can be reached but not chosen. The menu is placed with floating-ui against
// the viewport: above its trigger by preference, flipped below and shifted sideways when
// a short screen has no room, and capped to the height there is, so it never clips. Its
// fixed strategy also lets it escape the card's scrolling body.

import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Ban,
  CalendarClock,
  Check,
  CircleCheck,
  ClipboardList,
  Lock,
  OctagonX,
  TriangleAlert,
} from 'lucide-react';
import { Pill, type PillTone } from '@/components/Pill';
import type { SectionSnapshot } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import type { KitFit, KitSeat } from '@/lib/regis/kitSchema';
import { PartsLine, sectionParts } from './SectionTile';
import { useHelperFloating } from './useHelperFloating';
import { useOutsidePress } from './useOutsidePress';

export interface SectionOption {
  ids: string[];
  sections: SectionSnapshot[];
  fit: KitFit;
  seat: KitSeat;
  planned: boolean;
}

/** The planned group first, then the kit's other groups in the kit's order. */
export function sectionOptions(row: ChecklistRow): SectionOption[] {
  return [
    {
      ids: row.planned.map((section) => section.teachTableId),
      sections: row.planned,
      fit: 'fits',
      seat: row.plannedSeat ?? 'open',
      planned: true,
    },
    ...row.alternatives.map((option) => ({ ...option, planned: false })),
  ];
}

interface Fact {
  tone: PillTone;
  icon: ReactNode;
  key: TranslationKey;
}

const FIT_FACT: Readonly<Record<KitFit, Fact>> = {
  fits: {
    tone: 'success',
    icon: <CircleCheck size={12} />,
    key: 'regis.fit.fits',
  },
  time: {
    tone: 'danger',
    icon: <TriangleAlert size={12} />,
    key: 'regis.fit.time',
  },
  exam: {
    tone: 'danger',
    icon: <CalendarClock size={12} />,
    key: 'regis.fit.exam',
  },
};

function worstFact(option: SectionOption, refused: boolean): Fact {
  if (refused) {
    return {
      tone: 'danger',
      icon: <OctagonX size={12} />,
      key: 'regis.short.refused',
    };
  }
  if (option.seat === 'closed') {
    return {
      tone: 'danger',
      icon: <Lock size={12} />,
      key: 'regis.seat.closed',
    };
  }
  if (option.seat === 'full') {
    return { tone: 'danger', icon: <Ban size={12} />, key: 'seat.full' };
  }
  return FIT_FACT[option.fit];
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export interface SectionTrigger {
  props: Record<string, unknown>;
  open: boolean;
}

/** The tallest the menu grows, before the room on screen caps it lower. */
const MAX_MENU_HEIGHT = 320;

interface SectionListboxProps {
  subjectId: string;
  options: readonly SectionOption[];
  chosen: readonly string[];
  /** The group the page turned down in this visit, which cannot be chosen again. */
  refused: readonly string[] | null;
  /** Whether a kit backs the options; without one only the planned group shows. */
  hasKit: boolean;
  /**
   * Whether the options come from a kit past the age limit: they show with their facts
   * at prepare time, and the menu says they are from older data.
   */
  olderData?: boolean;
  onChoose: (option: SectionOption) => void;
  /** Which edge of the trigger the menu lines up with: the tile's start or the button's end. */
  align: 'start' | 'end';
  t: Translate;
  children: (trigger: SectionTrigger) => ReactNode;
}

export function SectionListbox({
  subjectId,
  options,
  chosen,
  refused,
  hasKit,
  olderData = false,
  onChoose,
  align,
  t,
  children,
}: SectionListboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const { setReference, setFloating, floatingStyles } = useHelperFloating(
    open,
    align === 'end' ? 'top-end' : 'top-start',
    MAX_MENU_HEIGHT,
  );
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useOutsidePress(wrapperRef, open, close);
  const disabled = (option: SectionOption) =>
    option.seat === 'closed' ||
    (refused !== null && sameIds(option.ids, refused));
  const chosenIndex = Math.max(
    0,
    options.findIndex((option) => sameIds(option.ids, chosen)),
  );

  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined || disabled(option)) return;
    setOpen(false);
    onChoose(option);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(chosenIndex);
        setOpen(true);
      }
      return;
    }
    const last = options.length - 1;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      setActive(move);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const optionId = (index: number) => `${listId}-${String(index)}`;
  const label = fillTemplate(t('regis.pickSectionFor'), { subjectId });
  // The menu prefers to open upward, since the card rises from the bottom of the screen.
  return (
    <span
      ref={wrapperRef}
      className={`relative flex ${align === 'end' ? 'min-w-0 flex-1 basis-0' : 'shrink-0'}`}
    >
      {children({
        props: {
          ref: setReference,
          onClick: () => {
            setActive(chosenIndex);
            setOpen(!open);
          },
          onKeyDown: handleKeyDown,
          role: 'combobox',
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'aria-controls': open ? listId : undefined,
          'aria-activedescendant': open ? optionId(active) : undefined,
        },
        open,
      })}
      {open ? (
        <div
          ref={setFloating}
          style={floatingStyles}
          className="kcp-scroll z-popover w-[296px] overflow-y-auto rounded-kcp border border-border bg-surface py-1 text-ink shadow-kcp kcp-fade-in max-sm:w-[calc(100vw-60px)]"
        >
          <p
            role="presentation"
            className="px-2 pt-1 pb-0.5 text-2xs text-ink-soft tabular-nums"
          >
            {label}
          </p>
          <ul id={listId} role="listbox" aria-label={label} className="px-1">
            {options.map((option, index) => {
              const off = disabled(option);
              const fact = worstFact(
                option,
                refused !== null && sameIds(option.ids, refused),
              );
              const parts = sectionParts(option.sections, t);
              return (
                <li
                  key={option.ids.join(' ')}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === chosenIndex}
                  aria-disabled={off || undefined}
                  onMouseEnter={() => {
                    setActive(index);
                  }}
                  onMouseDown={(event) => {
                    // Keep focus on the trigger, which names the active option.
                    event.preventDefault();
                    choose(index);
                  }}
                  className={`flex min-h-9 items-center gap-2 rounded-kcp px-2 py-1.5 max-sm:min-h-11 pointer-coarse:min-h-11 ${
                    index === active ? 'bg-primary-soft' : ''
                  } ${off ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Check
                    size={16}
                    aria-hidden
                    className={`shrink-0 text-primary-strong ${
                      index === chosenIndex ? '' : 'invisible'
                    }`}
                  />
                  <PartsLine parts={parts} muted={off} wide>
                    {option.planned ? (
                      <Pill tone="neutral">{t('regis.plan')}</Pill>
                    ) : null}
                  </PartsLine>
                  {hasKit || olderData ? (
                    <Pill tone={fact.tone} icon={fact.icon}>
                      {t(fact.key)}
                    </Pill>
                  ) : null}
                </li>
              );
            })}
            {hasKit ? null : (
              <li
                role="presentation"
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-ink-soft"
              >
                <ClipboardList size={16} aria-hidden className="shrink-0" />
                {t(olderData ? 'regis.olderData' : 'regis.noKitShort')}
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
