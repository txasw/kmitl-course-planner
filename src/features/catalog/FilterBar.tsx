// The instant local filter bar: free text, a day multi select, a credit select,
// and the hide full and hide conflicting toggles. It reads and writes the catalog
// store; filtering itself happens in the pure filter over the store state.

import { useStore } from 'zustand';
import type { DayOfWeek } from '@/lib/domain/types';
import { useTranslation } from '@/features/shell/useTranslation';
import { catalogStore } from './catalogStore';
import { dayLabelKey } from '@/lib/i18n/dayLabel';

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface FilterBarProps {
  creditOptions: number[];
}

export function FilterBar({ creditOptions }: FilterBarProps) {
  const { t } = useTranslation();
  const filter = useStore(catalogStore, (state) => state.filter);

  return (
    <div className="flex flex-col gap-2 rounded-kcp border border-border p-2">
      <input
        type="search"
        value={filter.text}
        placeholder={t('catalog.filter.text')}
        aria-label={t('catalog.filter.text')}
        onChange={(event) => {
          catalogStore.getState().setText(event.target.value);
        }}
        className="rounded-kcp border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:ring-2 focus:ring-primary focus:outline-none"
      />
      <div
        role="group"
        aria-label={t('catalog.filter.day')}
        className="flex gap-1"
      >
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
              className={`flex-1 rounded-kcp px-1 py-1 text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none ${
                active
                  ? 'bg-primary text-surface'
                  : 'bg-surface-alt text-ink-soft hover:text-ink'
              }`}
            >
              {t(dayLabelKey(day))}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-ink-soft">{t('catalog.filter.credit')}</span>
          <select
            value={filter.credit === null ? '' : String(filter.credit)}
            onChange={(event) => {
              const value = event.target.value;
              catalogStore
                .getState()
                .setCredit(value === '' ? null : Number(value));
            }}
            className="rounded-kcp border border-border bg-surface px-1.5 py-1 text-ink focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">{t('catalog.filter.creditAny')}</option>
            {creditOptions.map((credit) => (
              <option key={credit} value={String(credit)}>
                {credit}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={filter.hideFull}
            onChange={(event) => {
              catalogStore.getState().setHideFull(event.target.checked);
            }}
            className="accent-primary"
          />
          <span className="text-ink-soft">{t('catalog.filter.hideFull')}</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={filter.hideConflicting}
            onChange={(event) => {
              catalogStore.getState().setHideConflicting(event.target.checked);
            }}
            className="accent-primary"
          />
          <span className="text-ink-soft">
            {t('catalog.filter.hideConflicting')}
          </span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={filter.hideUnscheduled}
            onChange={(event) => {
              catalogStore.getState().setHideUnscheduled(event.target.checked);
            }}
            className="accent-primary"
          />
          <span className="text-ink-soft">
            {t('catalog.filter.hideUnscheduled')}
          </span>
        </label>
      </div>
    </div>
  );
}
