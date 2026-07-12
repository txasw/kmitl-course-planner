// The catalog filter: an always visible search field, a filter button that opens a popover
// with the day, credit, and hide facets, and the active facets rendered as removable chips
// under the field. Filtering itself happens in the pure filter over the catalog store state,
// which is untouched; the redesign only reshapes the controls.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Switch } from '@/components/Switch';
import type { DayOfWeek } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import type { CatalogFilter } from '@/lib/catalog/filter';
import { useTranslation } from '@/features/shell/useTranslation';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { FOCUS_RING, FOCUS_OUTLINE } from '@/lib/ui/focus';
import { Combobox, type ComboboxOption } from '@/features/search/Combobox';
import { catalogStore } from './catalogStore';

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface FilterBarProps {
  creditOptions: number[];
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function FilterBar({ creditOptions }: FilterBarProps) {
  const { t } = useTranslation();
  const filter = useStore(catalogStore, (state) => state.filter);

  const activeCount =
    (filter.days.length > 0 ? 1 : 0) +
    (filter.credit !== null ? 1 : 0) +
    Number(filter.hideFull) +
    Number(filter.hideConflicting) +
    Number(filter.hideUnscheduled);

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
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={filter.text}
          placeholder={t('catalog.filter.text')}
          aria-label={t('catalog.filter.text')}
          onChange={(event) => {
            catalogStore.getState().setText(event.target.value);
          }}
          className={`min-w-0 flex-1 rounded-kcp border border-border bg-surface px-2 py-1.5 text-sm text-ink ${FOCUS_RING}`}
        />
        <FilterPopover
          t={t}
          filter={filter}
          creditOptions={creditOptions}
          activeCount={activeCount}
        />
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`${t('action.remove')} ${chip.label}`}
              onClick={chip.onRemove}
              className={`inline-flex items-center gap-1 rounded-kcp bg-surface-alt px-2 py-0.5 text-ink-soft hover:text-ink ${FOCUS_RING}`}
            >
              {chip.label}
              <X size={12} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              catalogStore.getState().resetFilter();
            }}
            className={`rounded-kcp px-2 py-0.5 font-medium text-primary-strong hover:bg-primary-soft ${FOCUS_RING}`}
          >
            {t('catalog.filter.clearAll')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterPopover({
  t,
  filter,
  creditOptions,
  activeCount,
}: {
  t: Translate;
  filter: CatalogFilter;
  creditOptions: number[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const portalRoot = usePanelPortal();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
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
      className="z-50 flex min-w-56 flex-col gap-3 rounded-kcp border border-border bg-surface p-3 shadow-kcp"
      {...getFloatingProps()}
    >
      <div
        role="group"
        aria-label={t('catalog.filter.day')}
        className="flex flex-col gap-1"
      >
        <span className="text-xs font-medium text-ink-soft">
          {t('catalog.filter.day')}
        </span>
        <div className="flex gap-1">
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
                className={`flex-1 rounded-kcp px-1 py-1 text-xs font-medium ${
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
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={setReference}
        type="button"
        aria-expanded={open}
        aria-label={t('catalog.filter.label')}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-kcp border border-border px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-alt ${FOCUS_RING}`}
        {...getReferenceProps()}
      >
        <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
        {t('catalog.filter.label')}
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-strong px-1 text-[10px] font-semibold text-surface">
            {activeCount}
          </span>
        ) : null}
      </button>
      {portalRoot ? (
        <FloatingPortal root={portalRoot}>{panel}</FloatingPortal>
      ) : (
        panel
      )}
    </div>
  );
}
