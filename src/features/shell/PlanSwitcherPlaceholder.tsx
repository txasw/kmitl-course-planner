import { CalendarRange, ChevronDown } from 'lucide-react';
import { useTranslation } from './useTranslation';

// A disabled stand in for the plan switcher. Plan management arrives in a later
// phase; the control is shown disabled so its future place in the header is
// clear without offering an action that does nothing.
export function PlanSwitcherPlaceholder() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled
      aria-label={t('planSwitcher.label')}
      className="inline-flex items-center gap-2 rounded-kcp border border-border px-3 py-1.5 text-sm text-ink-soft"
    >
      <CalendarRange size={16} strokeWidth={2} aria-hidden />
      <span>{t('planSwitcher.placeholder')}</span>
      <ChevronDown size={16} strokeWidth={2} aria-hidden />
    </button>
  );
}
