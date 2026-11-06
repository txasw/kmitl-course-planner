// The plan view tabs of ADR-0049 on the medium and wide tiers: an underline tablist above
// the grid region that switches between the timetable and the list of placed subjects.
// The selected tab carries the subject count in its visible label, so the count is part of
// its accessible name. Arrow keys, Home, and End move focus and activate the tab in one
// step, and only the active tab sits in the tab order, the roving pattern of the ARIA
// tablist. The row is 40 px tall and tightens to 36 px under a max height of 800 px, so a
// 720 or 768 px laptop keeps grid height.

import { useRef, type KeyboardEvent } from 'react';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import type { PlanView } from '@/features/shell/uiStore';

const VIEWS: readonly PlanView[] = ['timetable', 'selected'];

const LABEL_KEY: Record<PlanView, TranslationKey> = {
  timetable: 'planView.timetable',
  selected: 'planView.selected',
};

/** The id of a plan view tab, which its tabpanel names through aria-labelledby. */
export function planViewTabId(view: PlanView): string {
  return `kcp-plan-view-tab-${view}`;
}

/** The id of a plan view tabpanel, which its tab names through aria-controls. */
export function planViewPanelId(view: PlanView): string {
  return `kcp-plan-view-panel-${view}`;
}

/** The view index a navigation key moves to from the current one, or null for any other
 * key. The arrows wrap around the ends. */
function targetIndex(key: string, index: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % VIEWS.length;
    case 'ArrowLeft':
      return (index - 1 + VIEWS.length) % VIEWS.length;
    case 'Home':
      return 0;
    case 'End':
      return VIEWS.length - 1;
    default:
      return null;
  }
}

interface PlanViewTabsProps {
  value: PlanView;
  /** The number of placed subjects, shown in the selected tab label. */
  selectedCount: number;
  onChange: (view: PlanView) => void;
  t: Translate;
}

export function PlanViewTabs({
  value,
  selectedCount,
  onChange,
  t,
}: PlanViewTabsProps) {
  const tabRefs = useRef(new Map<PlanView, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = targetIndex(event.key, VIEWS.indexOf(value));
    const next = index === null ? undefined : VIEWS[index];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onChange(next);
    tabRefs.current.get(next)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t('planView.label')}
      className="flex h-10 shrink-0 items-stretch gap-4 border-b border-border [@media(max-height:800px)]:h-9"
    >
      {VIEWS.map((view) => {
        const active = view === value;
        return (
          <button
            key={view}
            ref={(node) => {
              if (node === null) {
                tabRefs.current.delete(view);
              } else {
                tabRefs.current.set(view, node);
              }
            }}
            type="button"
            role="tab"
            id={planViewTabId(view)}
            aria-selected={active}
            aria-controls={planViewPanelId(view)}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onChange(view);
            }}
            onKeyDown={handleKeyDown}
            className={`-mb-px inline-flex items-center border-b-2 px-1 text-sm transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? 'border-primary font-semibold text-primary-strong'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {fillTemplate(t(LABEL_KEY[view]), { count: selectedCount })}
          </button>
        );
      })}
    </div>
  );
}
