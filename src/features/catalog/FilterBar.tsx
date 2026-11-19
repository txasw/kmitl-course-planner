// The catalog filter row: an always visible search field, then icon controls, a filter
// button that opens a popover with the day, credit, hide, and open to my curriculum
// facets, the sort, and any trailing action the catalog passes, such as expand all. Each
// icon control is named for assistive technology and shows its name in a tooltip, and
// the filter icon is followed by a badge counting the facets in use, set beside the icon
// rather than over it, which the button's name reads too.
// The active facets render as removable chips under the row, followed by one clear
// action whenever the text or any facet narrows the list. Filtering itself happens in
// the pure filter over the catalog store state, which is untouched; the redesign only
// reshapes the controls.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import {
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { Tooltip } from '@/components/Tooltip';
import type { DayOfWeek } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { CatalogFilter } from '@/lib/catalog/filter';
import { fillTemplate } from '@/lib/i18n/template';
import { useTranslation } from '@/features/shell/useTranslation';
import { CATALOG_FILTER_ID } from '@/features/shell/catalogVisibility';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { CONTROL_BOUNDARY } from '@/lib/ui/control';
import { FOCUS_RING, FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';
import { Combobox, type ComboboxOption } from '@/features/search/Combobox';
import { catalogStore } from './catalogStore';
import { CurriculumFilter } from './CurriculumProfilePicker';
import { SortControl } from './SortControl';

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface FilterBarProps {
  creditOptions: number[];
  /** Icon controls that close the row after the sort, such as expand all. */
  children?: ReactNode;
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function FilterBar({ creditOptions, children }: FilterBarProps) {
  const { t, language } = useTranslation();
  const filter = useStore(catalogStore, (state) => state.filter);
  const textRef = useRef<HTMLInputElement | null>(null);
  const activeCount = activeCountOf(filter);
  const filtering = filter.text.trim() !== '' || activeCount > 0;

  const handleClear = () => {
    catalogStore.getState().resetFilter();
    // The action unmounts once nothing is filtered, so focus returns to the field
    // rather than falling to the document body.
    textRef.current?.focus();
  };

  const chips: Chip[] = [
    ...filter.days.map((day) => ({
      key: `day-${String(day)}`,
      label: t(dayLabelKey(day)),
      onRemove: () => {
        catalogStore.getState().toggleDay(day);
      },
    })),
    ...(filter.credit !== null
      ? [
          {
            key: 'credit',
            label: `${t('catalog.filter.credit')} ${String(filter.credit)}`,
            onRemove: () => {
              catalogStore.getState().setCredit(null);
            },
          },
        ]
      : []),
    ...(filter.hideFull
      ? [
          {
            key: 'hideFull',
            label: t('catalog.filter.hideFull'),
            onRemove: () => {
              catalogStore.getState().setHideFull(false);
            },
          },
        ]
      : []),
    ...(filter.hideConflicting
      ? [
          {
            key: 'hideConflicting',
            label: t('catalog.filter.hideConflicting'),
            onRemove: () => {
              catalogStore.getState().setHideConflicting(false);
            },
          },
        ]
      : []),
    ...(filter.hideUnscheduled
      ? [
          {
            key: 'hideUnscheduled',
            label: t('catalog.filter.hideUnscheduled'),
            onRemove: () => {
              catalogStore.getState().setHideUnscheduled(false);
            },
          },
        ]
      : []),
    ...(filter.curriculum !== null
      ? [
          {
            key: 'curriculum',
            label: t('offeredTo.filter'),
            onRemove: () => {
              catalogStore.getState().setCurriculum(null);
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {/* The field is named for assistive technology, and the search glyph and the
            hint name it for the eye, so the row spends no line on a visible label. */}
        <div className="relative flex min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-soft"
          />
          <input
            ref={textRef}
            id={CATALOG_FILTER_ID}
            type="search"
            value={filter.text}
            aria-label={t('catalog.filter.fieldLabel')}
            placeholder={t('catalog.filter.text')}
            onChange={(event) => {
              catalogStore.getState().setText(event.target.value);
            }}
            className={`min-w-0 flex-1 rounded-kcp border py-1.5 pr-2 pl-8 text-sm text-ink ${TARGET_HEIGHT} ${CONTROL_BOUNDARY} ${FOCUS_RING}`}
          />
        </div>
        <FilterPopover
          t={t}
          locale={language}
          filter={filter}
          creditOptions={creditOptions}
          activeCount={activeCount}
        />
        <SortControl t={t} />
        {children}
      </div>
      {filtering ? (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`${t('action.remove')} ${chip.label}`}
              onClick={chip.onRemove}
              className={`inline-flex items-center gap-1 rounded-kcp bg-surface-alt px-2 py-0.5 text-left text-ink-soft hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
            >
              {chip.label}
              <X size={12} aria-hidden className="shrink-0" />
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className={`rounded-kcp px-2 py-0.5 text-primary-strong hover:bg-primary-soft ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            {t('catalog.filter.clearAll')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The number of popover facets in use, which the filter button shows as a count. */
function activeCountOf(filter: CatalogFilter): number {
  return (
    (filter.days.length > 0 ? 1 : 0) +
    (filter.credit !== null ? 1 : 0) +
    Number(filter.hideFull) +
    Number(filter.hideConflicting) +
    Number(filter.hideUnscheduled) +
    (filter.curriculum !== null ? 1 : 0)
  );
}

function FilterPopover({
  t,
  locale,
  filter,
  creditOptions,
  activeCount,
}: {
  t: Translate;
  locale: Locale;
  filter: CatalogFilter;
  creditOptions: number[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const portalRoot = usePanelPortal();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 4,
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
  });
  // Escape is handled manually so it can stop propagation and close only the popover, since
  // the popover may portal out of the trigger's wrapper and the overlay closes on Escape too.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { escapeKey: false }),
  ]);

  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node);
      triggerRef.current = node;
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  const creditComboOptions: ComboboxOption[] = [
    { value: '', label: t('catalog.filter.creditAny') },
    ...creditOptions.map((credit) => ({
      value: String(credit),
      label: String(credit),
    })),
  ];

  const panel = open ? (
    <div
      ref={setFloating}
      style={floatingStyles}
      aria-label={t('catalog.filter.label')}
      className={`z-popover flex min-w-56 ${PANEL_POPOVER_SCROLL} flex-col gap-3 rounded-kcp border border-border bg-surface p-3 shadow-kcp`}
      {...getFloatingProps()}
    >
      <div
        role="group"
        aria-label={t('catalog.filter.day')}
        className="flex flex-col gap-1"
      >
        <span className="text-xs font-semibold text-ink-soft">
          {t('catalog.filter.day')}
        </span>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((day) => {
            const active = filter.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  catalogStore.getState().toggleDay(day);
                }}
                className={`flex-1 rounded-kcp px-1 py-1 text-xs ${TARGET_SIZE} ${
                  active
                    ? 'bg-primary-strong text-surface'
                    : 'bg-surface-alt text-ink-soft hover:text-ink'
                } ${FOCUS_OUTLINE}`}
              >
                {t(dayLabelKey(day))}
              </button>
            );
          })}
        </div>
      </div>
      <Combobox
        label={t('catalog.filter.credit')}
        value={filter.credit === null ? '' : String(filter.credit)}
        placeholder={t('catalog.filter.creditAny')}
        disabled={false}
        searchable={false}
        options={creditComboOptions}
        onChange={(value) => {
          catalogStore
            .getState()
            .setCredit(value === '' ? null : Number(value));
        }}
      />
      <div className="flex flex-col">
        <Switch
          checked={filter.hideFull}
          label={t('catalog.filter.hideFull')}
          onChange={(checked) => {
            catalogStore.getState().setHideFull(checked);
          }}
        />
        <Switch
          checked={filter.hideConflicting}
          label={t('catalog.filter.hideConflicting')}
          onChange={(checked) => {
            catalogStore.getState().setHideConflicting(checked);
          }}
        />
        <Switch
          checked={filter.hideUnscheduled}
          label={t('catalog.filter.hideUnscheduled')}
          onChange={(checked) => {
            catalogStore.getState().setHideUnscheduled(checked);
          }}
        />
      </div>
      <CurriculumFilter
        active={filter.curriculum !== null}
        locale={locale}
        t={t}
      />
    </div>
  ) : null;

  const label = t('catalog.filter.label');
  const name =
    activeCount > 0
      ? fillTemplate(t('catalog.filter.labelActive'), {
          n: String(activeCount),
        })
      : label;

  return (
    <div className="relative">
      {/* The tooltip anchors to a wrapper, so the trigger keeps the popover's own
          reference and handlers; it stays shut while the popover is open. */}
      <Tooltip label={label} disabled={open}>
        {(triggerProps, ref) => (
          <span ref={ref} {...triggerProps} className="inline-flex">
            <button
              ref={setReference}
              type="button"
              aria-expanded={open}
              aria-label={name}
              className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-kcp text-ink hover:bg-surface-alt ${activeCount > 0 ? 'px-1.5' : ''} ${TARGET_SIZE} ${FOCUS_RING}`}
              {...getReferenceProps()}
            >
              <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
              {activeCount > 0 ? (
                <span
                  aria-hidden
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-strong px-1 text-[10px] font-semibold text-surface tabular-nums"
                >
                  {activeCount}
                </span>
              ) : null}
            </button>
          </span>
        )}
      </Tooltip>
      {portalRoot ? (
        <FloatingPortal root={portalRoot}>{panel}</FloatingPortal>
      ) : (
        panel
      )}
    </div>
  );
}
