// The plan view tabs of ADR-0049 on the medium and wide tiers: an underline tablist above
// the grid region that switches between the timetable, the list of placed subjects, and
// the summary. The selected tab carries the subject count in its visible label, so the
// count is part of its accessible name. While two placed subjects clash on an exam, the
// summary tab carries a danger dot with the clash in its accessible name, so the exam
// schedule that lists the clash stays one action away. Arrow keys, Home, and End move
// focus and activate the tab in one step, and only the active tab sits in the tab order,
// the roving pattern of the ARIA tablist. The row is 40 px tall and tightens to 36 px
// under a max height of 800 px, so a 720 or 768 px laptop keeps grid height. A trailing
// control, the updates indicator of ADR-0060, sits at the right of the row outside the
// tablist, since a tablist holds tabs only. The heights are minimums, so under a coarse
// pointer the row grows to the 44 px touch target of that control rather than clip it.

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import type { PlanView } from '@/features/shell/uiStore';

const VIEWS: readonly PlanView[] = ['timetable', 'selected', 'summary'];

const LABEL_KEY: Record<PlanView, TranslationKey> = {
  timetable: 'planView.timetable',
  selected: 'planView.selected',
  summary: 'planView.summary',
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
  /** Whether two placed subjects clash on an exam, marked on the summary tab. */
  examClash: boolean;
  onChange: (view: PlanView) => void;
  t: Translate;
  /** A control at the right of the row, outside the tablist. */
  trailing?: ReactNode;
}

export function PlanViewTabs({
  value,
  selectedCount,
  examClash,
  onChange,
  t,
  trailing,
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
    <div className="flex min-h-10 shrink-0 items-stretch gap-4 border-b border-border [@media(max-height:800px)]:min-h-9">
      <div
        role="tablist"
        aria-label={t('planView.label')}
        className="flex min-w-0 items-stretch gap-4"
      >
        {VIEWS.map((view) => {
          const active = view === value;
          const label = fillTemplate(t(LABEL_KEY[view]), {
            count: selectedCount,
          });
          const clashDot = view === 'summary' && examClash;
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
              aria-label={
                clashDot ? `${label} ${t('planView.examClash')}` : undefined
              }
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
              {label}
              {clashDot ? (
                <span
                  aria-hidden
                  className="ml-1.5 size-2 shrink-0 rounded-full bg-danger"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing === undefined ? null : (
        <div className="ml-auto flex shrink-0 items-center">{trailing}</div>
      )}
    </div>
  );
}
